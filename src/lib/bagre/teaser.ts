/**
 * What the group page shows about the Bagre. Read-only: it never opens a
 * period (only the Bagre screen does), and never reveals vote counts.
 */
import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { awardNominations, awardVotes } from "@/db/schema";
import type { MemberRow } from "@/lib/groups/queries";

import { BADGE_TITLE, formatDeadline, PERIOD_NOUN, rangeOf, type Cadence } from "./period";
import { currentBadges } from "./results";
import { findRoundAt, isAccepting, type BagreGroup } from "./rounds";

export interface BagreTeaser {
  title: string;
  holder: { name: string; image: string | null; isYou: boolean; of: string } | null;
  nominations: number;
  voters: number;
  /** Null when there's no open period yet (nobody opened the screen). */
  deadline: string | null;
  /** Members with a current badge, for the members list. */
  badges: Record<string, Cadence>;
}

export async function loadBagreTeaser(database: Database, group: BagreGroup, members: MemberRow[], now: Date): Promise<BagreTeaser> {
  const [round, holders] = await Promise.all([findRoundAt(database, group.id, now), currentBadges(database, group.id, now)]);
  const badges: Record<string, Cadence> = {};
  for (const [userId, b] of holders) if (members.some((m) => m.userId === userId)) badges[userId] = b.cadence;
  const holderId = Object.keys(badges)[0];
  const holderRow = members.find((m) => m.userId === holderId);
  const memberIds = members.map((m) => m.userId);
  let nominations = 0;
  let voters = 0;
  if (round && memberIds.length > 0) {
    const [row] = await database
      .select({
        nominations: sql<number>`count(distinct ${awardNominations.id})::int`,
        // Votes from members for nominations of members: participation only, never per nominee.
        voters: sql<number>`count(distinct ${awardVotes.voterId}) filter (where ${inArray(awardVotes.voterId, memberIds)})::int`,
      })
      .from(awardNominations)
      .leftJoin(awardVotes, eq(awardVotes.nominationId, awardNominations.id))
      .where(and(eq(awardNominations.roundId, round.id), inArray(awardNominations.nomineeId, memberIds)));
    nominations = row?.nominations ?? 0;
    voters = row?.voters ?? 0;
  }
  return {
    title: BADGE_TITLE[round?.cadence ?? group.bagreCadence],
    holder: holderRow
      ? { name: holderRow.name, image: holderRow.image, isYou: holderRow.isYou, of: PERIOD_NOUN[badges[holderRow.userId]!].of }
      : null,
    badges,
    nominations,
    voters,
    deadline: round && isAccepting(round, now) ? formatDeadline(rangeOf(round), now) : null,
  };
}
