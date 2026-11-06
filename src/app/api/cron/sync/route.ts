/**
 * POST /api/cron/sync — called every 10–15 min by an external scheduler
 * (Vercel Hobby cron only runs daily). SPEC §3, steps 2–7; step 6 (Discord
 * cards) runs after the accounts, with what's left of the time budget.
 *
 * Schedulers like cron-job.org give up after ~30 s, but a run can take up to
 * a minute. So by default the route answers 202 at once and does the work in
 * `after()` (still inside maxDuration); the summary goes to the logs.
 * Weekly summaries (src/lib/summary) go first, and only do work from Monday
 * 09:00 until every group with a webhook got last week's post; each run
 * spends at most SUMMARY_BUDGET_MS on them, then syncs as usual.
 *
 * `?wait=1` runs inline and returns the summary, for debugging by hand:
 *
 *   curl -X POST -H "Authorization: Bearer $CRON_SECRET" "https://<app>/api/cron/sync?wait=1"
 */
import { after } from "next/server";

import { db } from "@/db";
import { serverEnv } from "@/env";
import { providersFromEnv } from "@/lib/ai";
import { notifyNewMatches, type NotifyResult } from "@/lib/discord";
import { discordKey } from "@/lib/discord/key";
import { henrikClient } from "@/lib/henrik";
import { runWeeklySummaries, type WeeklyRunResult } from "@/lib/summary";
import { syncDueAccounts } from "@/lib/sync";
import { isAuthorizedCron } from "@/lib/sync/cron-auth";

export const maxDuration = 60;

/** Accounts per run: small enough to finish inside the function limit. */
const BATCH_SIZE = 5;
/** Stop starting new accounts after this, leaving room for the last one. */
const TIME_BUDGET_MS = 40_000;
/** Weekly summaries: don't start a group after this (each needs up to ~21 s). */
const SUMMARY_BUDGET_MS = 25_000;
/** Stop starting new Discord posts after this (maxDuration is 60 s). */
const DISCORD_BUDGET_MS = 52_000;

const NO_STORE = { "Cache-Control": "no-store" };

async function weekly(startedAt: number): Promise<WeeklyRunResult | { error: string }> {
  const key = discordKey();
  if (!key) return { error: "ENCRYPTION_KEY not set" };
  try {
    const env = serverEnv();
    return await runWeeklySummaries(db(), {
      key,
      providers: providersFromEnv(env),
      appUrl: env.BETTER_AUTH_URL,
      deadline: startedAt + SUMMARY_BUDGET_MS,
    });
  } catch (error) {
    console.error("[cron] weekly summary step failed", error);
    return { error: "weekly summary step failed" };
  }
}

async function run() {
  const startedAt = Date.now();
  const summaries = await weekly(startedAt);
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

  return {
    accounts: results.length,
    ok: results.filter((r) => r.status === "ok").length,
    errors: results.filter((r) => r.status === "error").length,
    newMatches: inserted.length,
    discord,
    summaries,
    durationMs: Date.now() - startedAt,
    results: results.map((r) => ({
      accountId: r.accountId,
      status: r.status,
      newMatches: r.inserted.length,
      error: r.error,
    })),
  };
}

export async function POST(request: Request) {
  if (!isAuthorizedCron(request.headers.get("authorization"), serverEnv().CRON_SECRET)) {
    return Response.json(
      { error: "unauthorized" },
      { status: 401, headers: { "WWW-Authenticate": "Bearer", ...NO_STORE } },
    );
  }

  if (new URL(request.url).searchParams.get("wait") === "1") {
    return Response.json(await run(), { headers: NO_STORE });
  }

  after(async () => {
    try {
      const summary = await run();
      console.info("[cron] sync", JSON.stringify({ ...summary, results: undefined }));
    } catch (error) {
      console.error("[cron] sync failed", error);
    }
  });
  return Response.json({ accepted: true }, { status: 202, headers: NO_STORE });
}
