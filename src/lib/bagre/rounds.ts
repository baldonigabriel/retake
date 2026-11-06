/**
 * Bagre periods in the database (SPEC §5.1). Framework-free (used by pages,
 * actions, the cron and scripts), takes the database and the clock.
 */
import { and, desc, eq, gt, lte } from "drizzle-orm";

import type { Database } from "@/db";
import { awardRounds, type AwardRound } from "@/db/schema";

import { nextPeriodRange, type Cadence } from "./period";

export const CATEGORY = "bagre" as const;

export interface BagreGroup {
  id: string;
  bagreEnabled: boolean;
  bagreCadence: Cadence;
}

/** The period containing `now`, open or not. Never writes. */
export async function findRoundAt(database: Database, groupId: string, now: Date): Promise<AwardRound | null> {
  const [row] = await database
    .select()
    .from(awardRounds)
    .where(
      and(
        eq(awardRounds.groupId, groupId),
        eq(awardRounds.category, CATEGORY),
        lte(awardRounds.startsAt, now),
        gt(awardRounds.endsAt, now),
      ),
    )
    .limit(1);
  return row ?? null;
}

/**
 * The period containing `now`, opening it when the Bagre is on and there's
 * none yet. Two concurrent calls open one row: the unique (group, category,
 * starts_at) turns the second insert into a no-op, and both read it back.
 */
export async function currentRound(database: Database, group: BagreGroup, now: Date): Promise<AwardRound | null> {
  const existing = await findRoundAt(database, group.id, now);
  if (existing || !group.bagreEnabled) return existing;

  const [latest] = await database
    .select({ endsAt: awardRounds.endsAt })
    .from(awardRounds)
    .where(and(eq(awardRounds.groupId, group.id), eq(awardRounds.category, CATEGORY)))
    .orderBy(desc(awardRounds.endsAt))
    .limit(1);
  const range = nextPeriodRange(group.bagreCadence, now, latest?.endsAt ?? null);
  if (!range) return null;

  const [created] = await database
    .insert(awardRounds)
    .values({ groupId: group.id, category: CATEGORY, cadence: group.bagreCadence, startsAt: range.start, endsAt: range.end })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [raced] = await database
    .select()
    .from(awardRounds)
    .where(and(eq(awardRounds.groupId, group.id), eq(awardRounds.category, CATEGORY), eq(awardRounds.startsAt, range.start)))
    .limit(1);
  return raced ?? null;
}

/** Whether nominations and votes are still accepted at `now`. */
export function isAccepting(round: Pick<AwardRound, "status" | "startsAt" | "endsAt">, now: Date): boolean {
  return round.status === "open" && now.getTime() >= round.startsAt.getTime() && now.getTime() < round.endsAt.getTime();
}
