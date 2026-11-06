/**
 * Links RR (won or lost) to competitive matches saved without it.
 *   pnpm rr:backfill            accounts linked to a user
 *   pnpm rr:backfill --all      also accounts created by sync:once
 *
 * Safe to rerun: accounts with nothing missing cost no request, snapshots
 * are inserted with ON CONFLICT DO NOTHING, and every call goes through the
 * shared rate-limited HenrikDev client (20 req/min, waits on 429).
 * Uses DATABASE_URL from .env.local: point it at production only on purpose.
 */
import { loadEnvConfig } from "@next/env";
import { asc, isNotNull } from "drizzle-orm";

import { db } from "../src/db";
import { riotAccounts } from "../src/db/schema";
import { henrikClient } from "../src/lib/henrik";
import { backfillRr } from "../src/lib/sync/backfill-rr";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

async function main(): Promise<number> {
  const all = process.argv.includes("--all");
  const deps = { db: db(), henrik: henrikClient() };
  const accounts = await deps.db
    .select()
    .from(riotAccounts)
    .where(all ? undefined : isNotNull(riotAccounts.userId))
    .orderBy(asc(riotAccounts.createdAt));

  let failed = 0;
  for (const account of accounts) {
    const r = await backfillRr(deps, account);
    if (r.error) failed++;
    console.log(
      `${r.riotId}: sem RR antes ${r.missingBefore} | ligados agora ${r.inserted} | ainda sem RR ${r.missingAfter} | ` +
        `requisições ${r.requests}${r.error ? ` | erro: ${r.error}` : ""}`,
    );
  }
  console.log(`${accounts.length} conta(s) verificadas${failed ? `, ${failed} com erro` : ""}.`);
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
