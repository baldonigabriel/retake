/**
 * Re-fetches old matches that predate Phase 9.
 *   pnpm rounds:backfill              matches containing a Retake user
 *   pnpm rounds:backfill --all        also unclaimed sync:once accounts
 *   pnpm rounds:backfill --limit 50   stop after 50 requests
 */
import { loadEnvConfig } from "@next/env";

import { db } from "../src/db";
import { henrikClient } from "../src/lib/henrik";
import { backfillRounds } from "../src/lib/sync/backfill-rounds";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

function readLimit(args: string[]): number | undefined {
  const index = args.indexOf("--limit");
  if (index < 0) return undefined;
  const limit = Number(args[index + 1]);
  if (!Number.isInteger(limit) || limit < 1) throw new Error("--limit precisa ser um inteiro positivo");
  return limit;
}

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  const results = await backfillRounds(
    { db: db(), henrik: henrikClient() },
    { includeUnclaimed: args.includes("--all"), limit: readLimit(args) },
  );
  let failures = 0;
  for (const result of results) {
    if (result.status === "error") failures++;
    console.log(
      `${result.matchId}: ${result.status} | rounds ${result.rounds} | jogadores ${result.players} | abates ${result.kills}` +
        (result.error ? ` | erro: ${result.error}` : ""),
    );
  }
  console.log(`${results.length} partida(s) processadas${failures ? `, ${failures} com erro` : ""}.`);
  return failures ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
