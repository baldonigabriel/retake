/**
 * Sync flow (docs/SPEC.md §3, steps 2–5 and 7; step 6, the Discord cards, is
 * src/lib/discord, run by the callers with the inserted match ids).
 * Framework-free: used by scripts/sync-once.ts now and by /api/cron/sync later.
 *
 * Idempotent by construction:
 * - matches are inserted with ON CONFLICT (id) DO NOTHING, players with
 *   ON CONFLICT (match_id, puuid) DO NOTHING, both in one Neon transaction
 *   (db.batch) so a match never exists without its players;
 * - MMR snapshots use the (puuid, match_id) unique index the same way.
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { matches, matchPlayers, mmrSnapshots, riotAccounts, type RiotAccount } from "@/db/schema";
import { playerCardUrl, type HenrikClient, type HenrikMmrEntry, type Platform, type Region } from "@/lib/henrik";

import { COMPETITIVE, includesPlayer, isStorable, queueIdOf, toMatchRow, toPlayerRows, toSnapshotRows } from "./map";

/** SPEC §3: query history with a small page and only store what's new. */
export const HISTORY_PAGE_SIZE = 5;

export interface SyncDeps {
  db: Database;
  henrik: HenrikClient;
  now?: () => Date;
}

export interface SyncResult {
  accountId: string;
  riotId: string;
  status: "ok" | "error";
  /** Matches returned by the history call. */
  fetched: number;
  /** Match ids written by this run. */
  inserted: string[];
  /** Already in the database (saved by an earlier run or a friend's sync). */
  alreadyStored: number;
  /** History items that failed validation or aren't finished. */
  skipped: number;
  snapshotsInserted: number;
  error?: string;
}

/** Looks up a Riot ID and creates or refreshes its riot_accounts row (by puuid). */
export async function upsertRiotAccount(
  deps: SyncDeps,
  riotId: { gameName: string; tagLine: string },
  options: { region?: Region; platform?: Platform } = {},
): Promise<RiotAccount> {
  const account = await deps.henrik.getAccount(riotId.gameName, riotId.tagLine);
  const values = {
    puuid: account.puuid,
    gameName: account.name,
    tagLine: account.tag,
    cardUrl: playerCardUrl(account.card),
  };
  const [row] = await deps.db
    .insert(riotAccounts)
    .values({ ...values, region: options.region ?? "br", platform: options.platform ?? "pc" })
    .onConflictDoUpdate({
      target: riotAccounts.puuid,
      set: { gameName: values.gameName, tagLine: values.tagLine, cardUrl: values.cardUrl },
    })
    .returning();
  return row!;
}

export interface SyncPage {
  /** Offset in the match history (0 = newest). */
  start?: number;
  /** Page size, capped at 10 by the API. */
  size?: number;
}

export async function syncAccount(
  deps: SyncDeps,
  account: RiotAccount,
  page: SyncPage = {},
): Promise<SyncResult> {
  const now = deps.now ?? (() => new Date());
  const result: SyncResult = {
    accountId: account.id,
    riotId: `${account.gameName}#${account.tagLine}`,
    status: "ok",
    fetched: 0,
    inserted: [],
    alreadyStored: 0,
    skipped: 0,
    snapshotsInserted: 0,
  };

  try {
    const region = account.region as Region;
    const platform = account.platform as Platform;

    // Step 3: recent history, small page.
    const history = await deps.henrik.getMatchHistory(region, platform, account.puuid, {
      size: page.size ?? HISTORY_PAGE_SIZE,
      start: page.start,
    });
    result.fetched = history.matches.length + history.invalid.length;

    const mine = history.matches.filter((m) => isStorable(m) && includesPlayer(m, account.puuid));
    result.skipped = result.fetched - mine.length;

    // Step 4: drop ids we already have; store the rest with all players.
    const ids = mine.map((m) => m.metadata.match_id);
    const existing =
      ids.length === 0
        ? []
        : await deps.db.select({ id: matches.id }).from(matches).where(inArray(matches.id, ids));
    const existingIds = new Set(existing.map((r) => r.id));
    result.alreadyStored = existingIds.size;

    for (const match of mine) {
      if (existingIds.has(match.metadata.match_id)) continue;
      const [insertedMatch] = await deps.db.batch([
        deps.db.insert(matches).values(toMatchRow(match)).onConflictDoNothing().returning({ id: matches.id }),
        deps.db.insert(matchPlayers).values(toPlayerRows(match)).onConflictDoNothing(),
      ]);
      if (insertedMatch.length > 0) result.inserted.push(match.metadata.match_id);
      else result.alreadyStored++; // a concurrent sync stored it first
    }

    // Step 5: refresh rank history when there's a new competitive match for
    // this account, or a recent one still without its RR (the API sometimes
    // lists a match before its RR update). "New" is relative to
    // last_match_at, so it also covers matches a friend's sync stored first.
    const lastMatchAt = account.lastMatchAt?.getTime() ?? Number.NEGATIVE_INFINITY;
    const newCompetitive = mine.some(
      (m) => queueIdOf(m) === COMPETITIVE && new Date(m.metadata.started_at).getTime() > lastMatchAt,
    );
    const pending = newCompetitive
      ? []
      : await matchesMissingRr(deps.db, account.puuid, new Date(now().getTime() - RR_PENDING_WINDOW_MS));
    if (newCompetitive || pending.length > 0) {
      const entries = await deps.henrik.getMmrHistory(region, platform, account.puuid);
      result.snapshotsInserted = await saveSnapshots(deps.db, account.puuid, entries);
    }

    // Step 7: bookkeeping.
    const newest = Math.max(lastMatchAt, ...mine.map((m) => new Date(m.metadata.started_at).getTime()));
    await deps.db
      .update(riotAccounts)
      .set({
        lastSyncedAt: now(),
        lastMatchAt: Number.isFinite(newest) ? new Date(newest) : null,
        syncStatus: "ok",
        syncError: null,
      })
      .where(eq(riotAccounts.id, account.id));
  } catch (error) {
    result.status = "error";
    result.error = error instanceof Error ? error.message : String(error);
    // Still bump last_synced_at so a failing account doesn't starve the rest.
    try {
      await deps.db
        .update(riotAccounts)
        .set({ lastSyncedAt: now(), syncStatus: "error", syncError: result.error.slice(0, 500) })
        .where(eq(riotAccounts.id, account.id));
    } catch {
      // Database is unreachable too; the result already carries the error.
    }
  }

  return result;
}

/**
 * A recent competitive match without RR keeps asking the live MMR history
 * (1 request per sync of that account) for this long; after that the match
 * shows "—" until a backfill finds it.
 */
export const RR_PENDING_WINDOW_MS = 6 * 3_600_000;

/** Competitive matches of `puuid` with no rank snapshot linked, newest first (optionally since a date). */
export async function matchesMissingRr(db: Database, puuid: string, since?: Date): Promise<string[]> {
  const rows = await db
    .select({ id: matches.id })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .leftJoin(mmrSnapshots, and(eq(mmrSnapshots.puuid, matchPlayers.puuid), eq(mmrSnapshots.matchId, matches.id)))
    .where(
      and(
        eq(matchPlayers.puuid, puuid),
        eq(matches.queueId, COMPETITIVE),
        isNull(mmrSnapshots.id),
        since ? gte(matches.startedAt, since) : undefined,
      ),
    )
    .orderBy(desc(matches.startedAt));
  return rows.map((r) => r.id);
}

/** Inserts the entries that carry a match id; the (puuid, match_id) index skips known ones. */
export async function saveSnapshots(db: Database, puuid: string, entries: readonly HenrikMmrEntry[]): Promise<number> {
  const rows = toSnapshotRows(puuid, entries);
  if (rows.length === 0) return 0;
  const inserted = await db
    .insert(mmrSnapshots)
    .values(rows)
    .onConflictDoNothing({ target: [mmrSnapshots.puuid, mmrSnapshots.matchId] })
    .returning({ id: mmrSnapshots.id });
  return inserted.length;
}

export interface SyncDueOptions {
  /** Only accounts linked to a user (skips the ones created by sync:once). */
  onlyClaimed?: boolean;
  /** Stop starting new accounts after this instant (function time budget). */
  deadline?: number;
}

/** Step 2: the N accounts synced longest ago (never-synced first), one by one. */
export async function syncDueAccounts(
  deps: SyncDeps,
  limit: number,
  options: SyncDueOptions = {},
): Promise<SyncResult[]> {
  const clock = () => (deps.now ?? (() => new Date()))().getTime();
  const due = await deps.db
    .select()
    .from(riotAccounts)
    .where(options.onlyClaimed ? isNotNull(riotAccounts.userId) : undefined)
    .orderBy(sql`${riotAccounts.lastSyncedAt} asc nulls first`, asc(riotAccounts.createdAt))
    .limit(limit);
  const results: SyncResult[] = [];
  for (const account of due) {
    if (options.deadline !== undefined && clock() >= options.deadline) break;
    results.push(await syncAccount(deps, account));
  }
  return results;
}
