/** Discord embed for the weekly summary. Pure. */
import { CARD_COLORS, WEBHOOK_USERNAME, escapeMarkdown, type DiscordEmbed, type WebhookPayload } from "@/lib/discord/card";
import { formatNumber } from "@/lib/format";

import type { WeeklyStats } from "./stats";
import type { SummaryProvider } from "./text";

const PROVIDER_NAME: Record<SummaryProvider, string> = { gemini: "Gemini", groq: "Groq", rules: "regras" };

export function providerLabel(provider: SummaryProvider, model: string | null): string {
  return provider === "rules" ? "Texto montado por regras a partir dos números" : `Texto escrito por IA (${PROVIDER_NAME[provider]}${model ? ` · ${model}` : ""}) a partir dos números`;
}

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

export function buildSummaryCard(input: {
  stats: WeeklyStats;
  text: string;
  provider: SummaryProvider;
  model: string | null;
  groupUrl?: string;
}): WebhookPayload {
  const { stats } = input;
  const fields: NonNullable<DiscordEmbed["fields"]> = [];
  if (stats.partidas > 0) {
    const empates = stats.empates > 0 ? ` ${stats.empates}E` : "";
    fields.push({ name: "Competitivas", value: `${stats.partidas} · ${stats.vitorias}V ${stats.derrotas}D${empates}`, inline: true });
  }
  if (stats.mvp) fields.push({ name: "MVP", value: `${escapeMarkdown(stats.mvp.nome)} · ${formatNumber(stats.mvp.acs)} ACS`, inline: true });
  if (stats.maiorPlacar) {
    fields.push({
      name: "Maior placar",
      value: `${escapeMarkdown(stats.maiorPlacar.nome)} · ${formatNumber(stats.maiorPlacar.acs)} ACS em ${escapeMarkdown(stats.maiorPlacar.mapa)}`,
      inline: true,
    });
  }
  if (stats.maisEvoluiu) {
    fields.push({
      name: "Quem mais evoluiu",
      value: `${escapeMarkdown(stats.maisEvoluiu.nome)} · +${formatNumber(stats.maisEvoluiu.diferenca)} ACS`,
      inline: true,
    });
  }

  return {
    username: WEBHOOK_USERNAME,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: clip(`Resumo da semana · ${stats.grupo}`, 256),
        url: input.groupUrl,
        description: clip(input.text, 4000),
        color: CARD_COLORS.brand,
        fields,
        footer: { text: clip(`${stats.semana} · ${providerLabel(input.provider, input.model)}`, 2048) },
      },
    ],
  };
}
