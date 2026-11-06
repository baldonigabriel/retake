/**
 * Weekly summary on demand, from the terminal (debug / preview).
 *
 *   pnpm summary:once <slug>                       → prints the numbers, the text and who wrote it
 *   pnpm summary:once <slug> --week last           → last week instead of the current one
 *   pnpm summary:once <slug> --webhook <url>       → also posts it to that webhook (e.g. a test channel)
 *   pnpm summary:once <slug> --send                → also posts it to the group's saved webhook
 *
 * It never writes weekly_summaries: the official Monday post from the cron
 * stays untouched, so previews can be run as often as you like.
 */
import { loadEnvConfig } from "@next/env";
import { eq } from "drizzle-orm";

import { db } from "../src/db";
import { groups } from "../src/db/schema";
import { serverEnv } from "../src/env";
import { providersFromEnv } from "../src/lib/ai";
import { decrypt, serverKey } from "../src/lib/crypto";
import { postWebhook } from "../src/lib/discord";
import { webhookContext } from "../src/lib/groups/webhook-context";
import { previousWeek, weekRange } from "../src/lib/groups/week";
import { prepareSummary } from "../src/lib/summary";

loadEnvConfig(process.cwd(), true, { info: () => {}, error: console.error });

const WEBHOOK = /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<number> {
  const slug = process.argv[2];
  if (!slug || slug.startsWith("--")) {
    console.error("Uso: pnpm summary:once <slug-do-grupo> [--week last] [--webhook <url>] [--send]");
    return 1;
  }
  const database = db();
  const [group] = await database.select().from(groups).where(eq(groups.slug, slug)).limit(1);
  if (!group) {
    console.error(`Grupo não encontrado: ${slug}`);
    return 1;
  }

  const current = weekRange(new Date());
  const week = arg("--week") === "last" ? previousWeek(current) : current;
  const env = serverEnv();
  const providers = providersFromEnv(env);
  console.log(`Provedores configurados: ${providers.map((p) => `${p.id} (${p.model})`).join(" → ") || "nenhum"} → regras`);

  const summary = await prepareSummary(database, group, week, providers, env.BETTER_AUTH_URL);
  console.log("\nNúmeros da semana:\n" + JSON.stringify(summary.stats, null, 2));
  console.log("\nTentativas:", summary.attempts.map((a) => `${a.provider}: ${a.outcome}`).join(", ") || "nenhuma");
  console.log(`\nProvedor que escreveu: ${summary.provider}${summary.model ? ` (${summary.model})` : ""}`);
  console.log(`\n${summary.text}\n`);

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
    const { messageId } = await postWebhook(target, summary.payload, { maxWaitMs: 10_000 });
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
