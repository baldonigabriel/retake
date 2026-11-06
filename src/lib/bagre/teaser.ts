/**
 * What the group page shows about the Bagre. Read-only: it never opens a
 * period (only the Bagre screen does), and never reveals vote counts.
 */
import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { awardNominations, awardVotes } from "@/db/schema";
import type { MemberRow } from "@/lib/groups/queries";

import { BADGE_TITLE, formatDeadline, rangeOf } from "./period";
import { findRoundAt, isAccepting, type BagreGroup } from "./rounds";

export interface BagreTeaser {
  title: string;
  holder: { name: string; image: string | null; isYou: boolean; of: string } | null;
  nominations: number;
  voters: number;
  /** Null when there's no open period yet (nobody opened the screen). */
  deadline: string | null;
}

export async function loadBagreTeaser(database: Database, group: BagreGroup, members: MemberRow[], now: Date): Promise<BagreTeaser> {
  const round = await findRoundAt(database, group.id, now);
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
    holder: null,
    nominations,
    voters,
    deadline: round && isAccepting(round, now) ? formatDeadline(rangeOf(round), now) : null,
  };
}
