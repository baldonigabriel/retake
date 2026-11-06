/**
 * RR backfill: links rank snapshots (RR won or lost) to competitive matches
 * that were saved before the sync tracked them, or whose RR update came late.
 *
 * Per account, cheapest first, and only while something is still missing:
 * 1. nothing missing → no request at all;
 * 2. the stored MMR history (HenrikDev's own records, reaches further back),
 *    one request with `size` sized to what we have;
 * 3. the live MMR history (last ~20 matches), one request, if (2) didn't
 *    cover everything.
 * Every call goes through the shared HenrikDev client, so the 20 req/min
 * queue, the X-RateLimit-* pause and the 429 Retry-After wait all apply.
 * Matches the API has no RR for stay without a snapshot: the UI shows "—",
 * never an estimate.
 */
import type { RiotAccount } from "@/db/schema";
import type { Platform, Region } from "@/lib/henrik";

import { matchesMissingRr, saveSnapshots, type SyncDeps } from "./sync-account";

/** Stored history page: everything we might be missing plus slack, capped. */
export function storedHistorySize(missing: number): number {
  return Math.min(200, Math.max(20, missing * 2));
}

export interface BackfillResult {
  accountId: string;
  riotId: string;
  missingBefore: number;
  missingAfter: number;
  inserted: number;
  requests: number;
  error?: string;
}

export async function backfillRr(deps: SyncDeps, account: RiotAccount): Promise<BackfillResult> {
  const result: BackfillResult = {
    accountId: account.id,
    riotId: `${account.gameName}#${account.tagLine}`,
    missingBefore: 0,
    missingAfter: 0,
    inserted: 0,
    requests: 0,
  };
  try {
    const region = account.region as Region;
    const platform = account.platform as Platform;
    const missing = await matchesMissingRr(deps.db, account.puuid);
    result.missingBefore = result.missingAfter = missing.length;
    if (missing.length === 0) return result;

    result.requests++;
    const stored = await deps.henrik.getStoredMmrHistory(region, platform, account.puuid, {
      size: storedHistorySize(missing.length),
    });
    result.inserted += await saveSnapshots(deps.db, account.puuid, stored);
    result.missingAfter = (await matchesMissingRr(deps.db, account.puuid)).length;

    if (result.missingAfter > 0) {
      result.requests++;
      const live = await deps.henrik.getMmrHistory(region, platform, account.puuid);
      result.inserted += await saveSnapshots(deps.db, account.puuid, live);
      result.missingAfter = (await matchesMissingRr(deps.db, account.puuid)).length;
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
  }
  return result;
}
