/**
 * What the group page shows about the Bagre. Read-only: it never opens a
 * period (only the Bagre screen does), and never reveals vote counts.
 */
import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { awardNominations } from "@/db/schema";
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
  if (round && memberIds.length > 0) {
    const [row] = await database
      .select({ n: sql<number>`count(*)::int` })
      .from(awardNominations)
      .where(and(eq(awardNominations.roundId, round.id), inArray(awardNominations.nomineeId, memberIds)));
    nominations = row?.n ?? 0;
  }
  return {
    title: BADGE_TITLE[round?.cadence ?? group.bagreCadence],
    holder: null,
    nominations,
    voters: 0,
    deadline: round && isAccepting(round, now) ? formatDeadline(rangeOf(round), now) : null,
  };
}
