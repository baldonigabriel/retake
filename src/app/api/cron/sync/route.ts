/**
 * POST /api/cron/sync — called every 10–15 min by an external scheduler
 * (Vercel Hobby cron only runs daily). SPEC §3, steps 2–7; step 6 (Discord
 * cards) runs after the accounts, with what's left of the time budget.
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/sync
 */
import { db } from "@/db";
import { serverEnv } from "@/env";
import { notifyNewMatches, type NotifyResult } from "@/lib/discord";
import { henrikClient } from "@/lib/henrik";
import { discordKey } from "@/lib/discord/key";
import { syncDueAccounts } from "@/lib/sync";
import { isAuthorizedCron } from "@/lib/sync/cron-auth";

export const maxDuration = 60;

/** Accounts per run: small enough to finish inside the function limit. */
const BATCH_SIZE = 5;
/** Stop starting new accounts after this, leaving room for the last one. */
const TIME_BUDGET_MS = 40_000;
/** Stop starting new Discord posts after this (maxDuration is 60 s). */
const DISCORD_BUDGET_MS = 52_000;

export async function POST(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" } },
    );
  }

  const startedAt = Date.now();
  const results = await syncDueAccounts({ db: db(), henrik: henrikClient() }, BATCH_SIZE, {
    onlyClaimed: true,
    deadline: startedAt + TIME_BUDGET_MS,
  });

  const inserted = results.flatMap((r) => r.inserted);
  let discord: NotifyResult | { error: string };
  const key = discordKey();
  if (!key) {
    discord = { error: "ENCRYPTION_KEY not set" };
  } else {
    try {
      discord = await notifyNewMatches(db(), inserted, {
        key,
        appUrl: serverEnv().BETTER_AUTH_URL,
        deadline: startedAt + DISCORD_BUDGET_MS,
      });
    } catch (error) {
      console.error("[cron] discord step failed", error);
      discord = { error: "discord step failed" };
    }
  }

  return Response.json(
    {
      accounts: results.length,
      ok: results.filter((r) => r.status === "ok").length,
      errors: results.filter((r) => r.status === "error").length,
      newMatches: inserted.length,
      discord,
      durationMs: Date.now() - startedAt,
      results: results.map((r) => ({
        accountId: r.accountId,
        status: r.status,
        newMatches: r.inserted.length,
        error: r.error,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
