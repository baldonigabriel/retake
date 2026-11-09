/**
 * Phase 9 round backfill. Every network call uses HenrikClient, therefore the
 * same 20 req/min queue, response-header pauses and Retry-After handling as
 * normal sync. Matches are fetched once and written atomically with a Neon
 * batch; incomplete payloads remain eligible for a later run.
 */
import { and, asc, eq, isNotNull, isNull, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { matchKills, matchPlayers, matchRoundPlayers, matchRounds, matches, riotAccounts } from "@/db/schema";
import type { HenrikClient, Region } from "@/lib/henrik";

import { toKillRows, toRoundPlayerRows, toRoundRows } from "./map";

export interface RoundBackfillTarget {
  matchId: string;
  region: Region;
  startedAt: Date;
}

export interface RoundBackfillResult {
  matchId: string;
  status: "updated" | "skipped" | "error";
  rounds: number;
  players: number;
  kills: number;
  error?: string;
}

export function uniqueBackfillTargets(
  rows: ReadonlyArray<{ matchId: string; region: string; startedAt: Date }>,
): RoundBackfillTarget[] {
  const seen = new Set<string>();
  return rows.flatMap((row) => {
    if (seen.has(row.matchId)) return [];
    seen.add(row.matchId);
    return [{ matchId: row.matchId, region: row.region as Region, startedAt: row.startedAt }];
  });
}

/** Oldest first so a bounded run steadily closes the historical gap. */
export async function roundsMissingBackfill(db: Database, includeUnclaimed = false): Promise<RoundBackfillTarget[]> {
  const rows = await db
    .select({ matchId: matches.id, region: riotAccounts.region, startedAt: matches.startedAt })
    .from(matches)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .innerJoin(riotAccounts, eq(riotAccounts.puuid, matchPlayers.puuid))
    .where(and(isNull(matches.roundsSyncedAt), includeUnclaimed ? undefined : isNotNull(riotAccounts.userId)))
    .orderBy(asc(matches.startedAt), asc(matches.id));
  return uniqueBackfillTargets(rows);
}

export async function backfillRoundMatch(
  deps: { db: Database; henrik: HenrikClient; now?: () => Date },
  target: RoundBackfillTarget,
): Promise<RoundBackfillResult> {
  const result: RoundBackfillResult = { matchId: target.matchId, status: "skipped", rounds: 0, players: 0, kills: 0 };
  try {
    const payload = await deps.henrik.getMatch(target.region, target.matchId);
    if (payload.metadata.match_id !== target.matchId) throw new Error("HenrikDev returned a different match id");
    if (payload.rounds == null) return result;

    const roundRows = toRoundRows(payload);
    const playerRows = toRoundPlayerRows(payload);
    const killRows = toKillRows(payload);
    const noOp = () => deps.db.execute(sql`select 1 where false`);
    await deps.db.batch([
      deps.db.delete(matchKills).where(eq(matchKills.matchId, target.matchId)),
      deps.db.delete(matchRoundPlayers).where(eq(matchRoundPlayers.matchId, target.matchId)),
      deps.db.delete(matchRounds).where(eq(matchRounds.matchId, target.matchId)),
      roundRows.length > 0 ? deps.db.insert(matchRounds).values(roundRows) : noOp(),
      playerRows.length > 0 ? deps.db.insert(matchRoundPlayers).values(playerRows) : noOp(),
      killRows.length > 0 ? deps.db.insert(matchKills).values(killRows) : noOp(),
      deps.db
        .update(matches)
        .set({ roundsSyncedAt: (deps.now ?? (() => new Date()))() })
        .where(and(eq(matches.id, target.matchId), isNull(matches.roundsSyncedAt))),
    ]);
    return {
      matchId: target.matchId,
      status: "updated",
      rounds: roundRows.length,
      players: playerRows.length,
      kills: killRows.length,
    };
  } catch (error) {
    result.status = "error";
    result.error = error instanceof Error ? error.message : String(error);
    return result;
  }
}

export async function backfillRounds(
  deps: { db: Database; henrik: HenrikClient; now?: () => Date },
  options: { includeUnclaimed?: boolean; limit?: number } = {},
): Promise<RoundBackfillResult[]> {
  const targets = await roundsMissingBackfill(deps.db, options.includeUnclaimed);
  const limited = options.limit == null ? targets : targets.slice(0, Math.max(0, options.limit));
  const results: RoundBackfillResult[] = [];
  // Deliberately sequential: HenrikClient's shared queue is the rate-limit boundary.
  for (const target of limited) results.push(await backfillRoundMatch(deps, target));
  return results;
}
