/**
 * Discord embed for a closed Bagre period. Pure. Light tone, only what the
 * group already sees: the nominee, the comment, their own line in the match
 * and the votes. Names and comments are escaped and mentions are off, so a
 * comment like "@everyone" never pings the channel.
 */
import { CARD_COLORS, WEBHOOK_USERNAME, escapeMarkdown, type DiscordEmbed, type WebhookPayload } from "@/lib/discord/card";
import { WEEK_TIME_ZONE } from "@/lib/groups/week";

import { describeLine } from "./display";
import { BADGE_TITLE, formatPeriod, rangeOf } from "./period";
import type { ResultEntry, RoundResult } from "./results";

const clip = (text: string, max: number) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);
const votes = (n: number) => `${n} ${n === 1 ? "voto" : "votos"}`;

function matchValue(entry: ResultEntry, appUrl?: string): string {
  const line = entry.line ? escapeMarkdown(describeLine(entry.line)) : "Partida indisponível";
  return appUrl ? `${line}\n[Ver partida](${appUrl}/match/${encodeURIComponent(entry.matchId)})` : line;
}

function badgeDate(date: Date): string {
  // badge_until is exclusive: the last day with the badge is the day before.
  return new Date(date.getTime() - 1)
    .toLocaleDateString("pt-BR", { timeZone: WEEK_TIME_ZONE, weekday: "long", day: "numeric", month: "short" })
    .replace(/\./g, "");
}

/** Null when there's nothing to announce (no winner and no declared tie). */
export function buildBagreCard(input: { groupName: string; result: RoundResult; groupSlug: string; appUrl?: string }): WebhookPayload | null {
  const { result, appUrl } = input;
  const title = BADGE_TITLE[result.cadence];
  const period = formatPeriod(rangeOf(result));
  const url = appUrl ? `${appUrl}/groups/${input.groupSlug}/bagre` : undefined;

  let embed: DiscordEmbed;
  if (result.outcome === "winner" && result.winner) {
    const w = result.winner;
    const by = w.nominator ? `indicação de ${escapeMarkdown(w.nominator.name)}` : "indicação de alguém do grupo";
    const fields: NonNullable<DiscordEmbed["fields"]> = [
      { name: "A partida", value: clip(matchValue(w, appUrl), 1024) },
      { name: "Votos", value: `${votes(w.votes)} de ${result.votesCast}`, inline: true },
    ];
    if (result.byTieBreak) {
      fields.push({ name: "Desempate", value: "Empatou nos votos e jogou menos partidas no período", inline: true });
    }
    embed = {
      title: clip(`🐟 ${escapeMarkdown(w.nominee.name)} é o ${title}`, 256),
      url,
      description: clip(`“${escapeMarkdown(w.comment)}”\n— ${by}`, 4000),
      color: CARD_COLORS.brand,
      fields,
      footer: {
        text: clip(
          `${input.groupName} · ${period} · fica com o selo até ${result.badgeUntil ? badgeDate(result.badgeUntil) : "o fim do próximo período"}. Bola pra frente!`,
          2048,
        ),
      },
    };
  } else if (result.outcome === "tie" && result.tied.length > 1) {
    const names = result.tied.map((e) => escapeMarkdown(e.nominee.name));
    const list = `${names.slice(0, -1).join(", ")} e ${names.at(-1)}`;
    embed = {
      title: clip(`🐟 Empate declarado no ${title}`, 256),
      url,
      description: clip(
        `${list} empataram com ${votes(result.tied[0]!.votes)} cada e o mesmo número de partidas. Ninguém leva o selo desta vez.`,
        4000,
      ),
      color: CARD_COLORS.brand,
      fields: result.tied.slice(0, 10).map((e) => ({
        name: clip(escapeMarkdown(e.nominee.name), 256),
        value: clip(`“${escapeMarkdown(e.comment)}”\n${matchValue(e, appUrl)}`, 1024),
      })),
      footer: { text: clip(`${input.groupName} · ${period}`, 2048) },
    };
  } else {
    return null;
  }
  return { username: WEBHOOK_USERNAME, allowed_mentions: { parse: [] }, embeds: [embed] };
}
