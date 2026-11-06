/**
 * Bagre result on demand, from the terminal (debug / preview).
 *
 *   pnpm bagre:once <slug>                    → prints how the current period would close right now
 *   pnpm bagre:once <slug> --last             → the last closed period instead (as stored)
 *   pnpm bagre:once <slug> --webhook <url>    → also posts the card to that webhook (e.g. a test channel)
 *   pnpm bagre:once <slug> --send             → also posts it to the group's saved webhook
 *
 * It never closes a period nor writes award_rounds: the official close by
 * the cron stays untouched, so previews can be run as often as you like.
 */
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { groups } from "../src/db/schema";
import { serverEnv } from "../src/env";
import { buildBagreCard } from "../src/lib/bagre/card";
import { previewClose } from "../src/lib/bagre/close";
import { describeLine } from "../src/lib/bagre/display";
import { formatPeriod, rangeOf } from "../src/lib/bagre/period";
import { loadResults } from "../src/lib/bagre/results";
import { findRoundAt } from "../src/lib/bagre/rounds";
import { decrypt, serverKey } from "../src/lib/crypto";
import { postWebhook } from "../src/lib/discord";
import { webhookContext } from "../src/lib/groups/webhook-context";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const slug = process.argv[2];
  if (!slug || slug.startsWith("--")) {
    console.error("Uso: pnpm bagre:once <slug-do-grupo> [--last] [--webhook <url>] [--send]");
    return 1;
  }
  const database = db();
  const [group] = await database.select().from(groups).where(eq(groups.slug, slug)).limit(1);
  if (!group) {
    console.error(`Grupo não encontrado: ${slug}`);
    return 1;
  }

  const now = new Date();
  let result;
  if (process.argv.includes("--last")) {
    [result] = await loadResults(database, group.id, { limit: 1, skipEmpty: true });
    if (!result) {
      console.error("Esse grupo ainda não tem período encerrado com resultado.");
      return 1;
    }
  } else {
    const round = await findRoundAt(database, group.id, now);
    if (!round) {
      console.error("Não há período aberto agora (ninguém abriu a tela do Bagre neste período).");
      return 1;
    }
    result = await previewClose(database, round, group.bagreEnabled, now);
  }
  if (!result) return 1;

  console.log(`Período: ${formatPeriod(rangeOf(result))} (${result.cadence}) · resultado: ${result.outcome} · ${result.votesCast} voto(s)`);
  for (const e of result.entries) {
    console.log(`  ${e.votes} voto(s) · ${e.matches} partida(s) · ${e.nominee.name}: “${e.comment}”${e.line ? ` · ${describeLine(e.line)}` : ""}`);
  }

  const payload = buildBagreCard({ groupName: group.name, groupSlug: group.slug, result, appUrl: serverEnv().BETTER_AUTH_URL });
  if (!payload) {
    console.log("\nNada a anunciar (sem vencedor nem empate).");
    return 0;
  }
  console.log("\nCard:\n" + JSON.stringify(payload, null, 2));

  let target = arg("--webhook");
  if (target && !WEBHOOK.test(target)) {
    console.error("Isso não parece um webhook do Discord.");
    return 1;
  }
  if (!target && process.argv.includes("--send")) {
    if (!group.discordWebhookUrl) {
      console.error("O grupo não tem webhook salvo. Use --webhook <url>.");
      return 1;
    }
    target = decrypt(group.discordWebhookUrl, serverKey(), webhookContext(group.id));
  }
  if (target) {
    const { messageId } = await postWebhook(target, payload, { maxWaitMs: 10_000 });
    console.log(`Enviado ao Discord (mensagem ${messageId ?? "sem id"}).`);
  }
  return 0;
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    console.error(error);
    process.exit(1);
  },
);
