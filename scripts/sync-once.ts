/**
 * Sync a single Riot ID from the terminal (debug).
 *   pnpm sync:once "Nome#TAG"
 *
 * Looks up the account, creates/refreshes its riot_accounts row (unclaimed:
 * no user yet), runs the same sync the cron will run and prints row counts
 * so reruns can be checked for duplicates.
 */
import { loadEnvConfig } from "@next/env";
import { count, desc, eq, sql } from "drizzle-orm";

import { db } from "../src/db";
import { matches, matchPlayers, mmrSnapshots, riotAccounts } from "../src/db/schema";
import { HenrikApiError, henrikClient } from "../src/lib/henrik";
import { parseRiotId } from "../src/lib/riot-id";
import { acs } from "../src/lib/stats";
import { syncAccount, upsertRiotAccount } from "../src/lib/sync";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

async function main(): Promise<number> {
  const input = process.argv[2];
  const riotId = input ? parseRiotId(input) : null;
  if (!riotId) {
    console.error('Uso: pnpm sync:once "Nome#TAG"');
    return 1;
  }

  const deps = { db: db(), henrik: henrikClient() };

  let account;
  try {
    account = await upsertRiotAccount(deps, riotId);
  } catch (error) {
    if (error instanceof HenrikApiError && error.status === 404) {
      console.error(`Riot ID não encontrado: ${riotId.gameName}#${riotId.tagLine}`);
      return 1;
    }
    throw error;
  }
  console.log(`Conta: ${account.gameName}#${account.tagLine} (${account.region}/${account.platform})`);

  const result = await syncAccount(deps, account);
  if (result.status === "error") {
    console.error(`Falha no sync: ${result.error}`);
    return 1;
  }

  console.log(
    `Histórico: ${result.fetched} partidas | novas: ${result.inserted.length} | ` +
      `já salvas: ${result.alreadyStored} | ignoradas: ${result.skipped} | ` +
      `snapshots de rank novos: ${result.snapshotsInserted}`,
  );

  const [last] = await deps.db
    .select({
      id: matches.id,
      map: matches.mapName,
      queue: matches.queueId,
      startedAt: matches.startedAt,
      rounds: matches.roundsPlayed,
      score: matchPlayers.score,
      kills: matchPlayers.kills,
      deaths: matchPlayers.deaths,
      assists: matchPlayers.assists,
      agent: matchPlayers.agentName,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(eq(matchPlayers.puuid, account.puuid))
    .orderBy(desc(matches.startedAt))
    .limit(1);

  if (last) {
    const [lines] = await deps.db
      .select({ n: count() })
      .from(matchPlayers)
      .where(eq(matchPlayers.matchId, last.id));
    console.log(
      `Última partida: ${last.map} (${last.queue}), ${last.agent}, ` +
        `${last.kills}/${last.deaths}/${last.assists}, ACS ${Math.round(acs(last.score, last.rounds))}, ` +
        `${last.startedAt.toISOString()} — ${lines?.n ?? 0} linhas em match_players`,
    );
  }

  const tables = { riot_accounts: riotAccounts, matches, match_players: matchPlayers, mmr_snapshots: mmrSnapshots };
  const counts: Record<string, number> = {};
  for (const [name, table] of Object.entries(tables)) {
    const [row] = await deps.db.select({ n: sql<number>`count(*)::int` }).from(table);
    counts[name] = row?.n ?? 0;
  }
  console.log("Linhas por tabela:", JSON.stringify(counts));
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
