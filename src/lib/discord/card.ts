/**
 * Discord match card (one embed). Pure: takes the stored match and its ten
 * players plus which of them are members of the group, returns the webhook
 * payload. Metrics use the same formulas as the rest of the app.
 *
 * One card per match and group: every member who played is listed, never one
 * card per member (SPEC §3, step 6). Players who aren't members appear only
 * in the placement count ("3º maior ACS da partida"), never by name.
 */
import { agentIconUrl, mapThumbUrl } from "@/lib/assets";
import { formatDuration, formatNumber, formatPercent } from "@/lib/format";
import { modeLabel } from "@/lib/modes";
import { matchResult } from "@/lib/stats/aggregate";
import { playerScore } from "@/lib/stats/breakdown";
import { acs, adr, hsRate, kd, type MatchResult } from "@/lib/stats/metrics";

export interface CardMatch {
  id: string;
  mapId: string | null;
  mapName: string | null;
  queueId: string;
  mode: string | null;
  startedAt: Date;
  gameLengthMs: number | null;
  roundsPlayed: number;
  redScore: number | null;
  blueScore: number | null;
  winningTeam: string | null;
}

export interface CardPlayer {
  puuid: string;
  gameName: string;
  team: string;
  agentId: string | null;
  agentName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  damageDealt: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  won: boolean;
}

/** Discord's embed object (only the fields we use). */
export interface DiscordEmbed {
  title: string;
  description?: string;
  url?: string;
  color: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  thumbnail?: { url: string };
  image?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

export interface WebhookPayload {
  username: string;
  embeds: DiscordEmbed[];
  /** Always empty: a player named "@everyone" must never ping the channel. */
  allowed_mentions: { parse: [] };
}

/** DESIGN.md result tokens as Discord colour ints. */
export const CARD_COLORS = {
  win: 0x34d3a6,
  loss: 0xd9575f,
  draw: 0xa1a1a3,
  brand: 0xff4655,
} as const;

const RESULT_TITLE: Record<MatchResult, string> = { win: "Vitória", loss: "Derrota", draw: "Empate" };
const RESULT_LETTER: Record<MatchResult, string> = { win: "V", loss: "D", draw: "E" };

export const WEBHOOK_USERNAME = "Retake";

/** Discord markdown would turn names like "*_x_*" into formatting. */
export function escapeMarkdown(text: string): string {
  return text.replace(/([\\*_~`|>#[\]()-])/g, "\\$1");
}

function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

const isTeamMode = (players: readonly CardPlayer[]) =>
  new Set(players.map((p) => p.team.toLowerCase())).size === 2 &&
  players.every((p) => ["red", "blue"].includes(p.team.toLowerCase()));

function playerAcs(match: CardMatch, p: CardPlayer): number {
  return acs(p.score, match.roundsPlayed);
}

/** Highest ACS first; kills break ties so the order is stable. */
function byAcs(match: CardMatch) {
  return (a: CardPlayer, b: CardPlayer) => playerAcs(match, b) - playerAcs(match, a) || b.kills - a.kills;
}

export interface Highlight {
  player: CardPlayer;
  /** "maior ACS da partida", "maior ACS do time", "4º maior ACS da partida" */
  label: string;
}

/** The member with the best ACS, and where that ACS places them in the match. */
export function pickHighlight(match: CardMatch, players: readonly CardPlayer[], members: readonly CardPlayer[]): Highlight | null {
  const best = [...members].sort(byAcs(match))[0];
  if (!best) return null;
  const all = [...players].sort(byAcs(match));
  const place = all.findIndex((p) => p.puuid === best.puuid) + 1;
  if (place === 1) return { player: best, label: "maior ACS da partida" };
  if (isTeamMode(players)) {
    const team = all.filter((p) => p.team === best.team);
    if (team[0]?.puuid === best.puuid) return { player: best, label: "maior ACS do time" };
  }
  return { player: best, label: `${place}º maior ACS da partida` };
}

function statLines(match: CardMatch, p: CardPlayer): string {
  const k = `${p.kills}/${p.deaths}/${p.assists}`;
  return [
    `ACS **${formatNumber(playerAcs(match, p))}** · K/D **${formatNumber(kd(p.kills, p.deaths), 2)}** · ${k}`,
    `HS% **${formatPercent(hsRate(p.headshots, p.bodyshots, p.legshots))}** · ADR **${formatNumber(adr(p.damageDealt, match.roundsPlayed))}**`,
  ].join("\n");
}

export interface MatchCardInput {
  match: CardMatch;
  /** All players stored for the match. */
  players: readonly CardPlayer[];
  /** Puuids of the group's members (only those in the match matter). */
  memberPuuids: readonly string[];
  groupName: string;
  /** Public base URL, for the link to the match page. */
  appUrl?: string;
}

export function buildMatchCard({ match, players, memberPuuids, groupName, appUrl }: MatchCardInput): WebhookPayload {
  const memberSet = new Set(memberPuuids);
  const members = players.filter((p) => memberSet.has(p.puuid)).sort(byAcs(match));
  if (members.length === 0) throw new Error("no group member played this match");

  const mapName = match.mapName ?? "mapa desconhecido";
  const teams = isTeamMode(players);
  const sameTeam = new Set(members.map((m) => m.team)).size === 1;
  const lead = members[0]!;
  const result = matchResult({ won: lead.won, winningTeam: match.winningTeam });

  // Title answers "how did it go?": result and score when everyone was on one side.
  let title: string;
  let color: number;
  if (teams && sameTeam) {
    const { own, enemy } = playerScore({ team: lead.team, redScore: match.redScore, blueScore: match.blueScore });
    title = `${RESULT_TITLE[result]} em ${mapName} · ${own}–${enemy}`;
    color = CARD_COLORS[result];
  } else if (teams) {
    title = `Grupo dos dois lados em ${mapName} · ${match.redScore ?? 0}–${match.blueScore ?? 0}`;
    color = CARD_COLORS.draw;
  } else {
    title = `${modeLabel(match.queueId, match.mode)} em ${mapName}`;
    color = CARD_COLORS.draw;
  }

  const unix = Math.floor(match.startedAt.getTime() / 1000);
  const meta = [modeLabel(match.queueId, match.mode), match.gameLengthMs ? formatDuration(match.gameLengthMs) : null, `<t:${unix}:R>`];

  const highlight = pickHighlight(match, players, members);
  const showResultPerMember = teams && !sameTeam;

  const fields: NonNullable<DiscordEmbed["fields"]> = members.map((m) => {
    const prefix = showResultPerMember ? `${RESULT_LETTER[matchResult({ won: m.won, winningTeam: match.winningTeam })]} · ` : "";
    return {
      name: clip(`${prefix}${escapeMarkdown(m.gameName)} · ${m.agentName ?? "Agente"}`, 256),
      value: statLines(match, m),
    };
  });
  if (highlight) {
    fields.push({
      name: "Destaque",
      value: clip(
        `**${escapeMarkdown(highlight.player.gameName)}** de ${highlight.player.agentName ?? "agente"}: ${highlight.label} (${formatNumber(playerAcs(match, highlight.player))})`,
        1024,
      ),
    });
  }

  const thumb = agentIconUrl(highlight?.player.agentId);
  const image = mapThumbUrl(match.mapId);
  const end = new Date(match.startedAt.getTime() + (match.gameLengthMs ?? 0));

  return {
    username: WEBHOOK_USERNAME,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: clip(title, 256),
        description: meta.filter(Boolean).join(" · "),
        url: appUrl ? `${appUrl.replace(/\/+$/, "")}/match/${encodeURIComponent(match.id)}` : undefined,
        color,
        fields,
        thumbnail: thumb ? { url: thumb } : undefined,
        image: image ? { url: image } : undefined,
        footer: { text: clip(`${groupName} · Retake`, 2048) },
        timestamp: end.toISOString(),
      },
    ],
  };
}

/** "Enviar mensagem de teste": shows the channel is wired, with no real stats. */
export function buildTestCard({ groupName, appUrl, now }: { groupName: string; appUrl?: string; now: Date }): WebhookPayload {
  return {
    username: WEBHOOK_USERNAME,
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: "Canal conectado ao Retake",
        description: `Tudo certo. Depois de cada partida de alguém do grupo **${escapeMarkdown(groupName)}**, um card com resultado, mapa, agente, ACS, K/D, HS% e ADR aparece aqui.`,
        url: appUrl ? appUrl.replace(/\/+$/, "") : undefined,
        color: CARD_COLORS.brand,
        footer: { text: clip(`${groupName} · Mensagem de teste · Retake`, 2048) },
        timestamp: now.toISOString(),
      },
    ],
  };
}
