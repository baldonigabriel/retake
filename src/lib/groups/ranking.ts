/**
 * Group screens over the members' match lines. Pure: the page loads lines
 * for the members' puuids only (never anyone else) and passes them here.
 *
 * - Weekly ranking: one mode at a time (default competitive), metrics
 *   computed with the same volume-weighted formulas as the dashboard.
 * - MVP of the week: fixed rule, always competitive (see MVP_RULE).
 * - Together: matches where 2+ members were on the same team.
 */
import { ALL_MODES, DEFAULT_MODE, filterByMode, matchResult, summarize, type StatSummary } from "@/lib/stats/aggregate";
import { playerScore, type DashboardLine } from "@/lib/stats/breakdown";
import { acs, type MatchResult } from "@/lib/stats/metrics";
import type { PlayerRoundMetrics } from "@/lib/rounds";

import { inWeek, type WeekRange } from "./week";

export interface GroupMember {
  userId: string;
  /** Null when the member has no Riot account linked (they show up, but unranked). */
  puuid: string | null;
  name: string;
  tag: string | null;
  image: string | null;
  role: "owner" | "member";
  isYou: boolean;
}

export interface GroupLine extends DashboardLine {
  puuid: string;
}

/* -------------------------------------------------------------- ranking -- */

export const RANKING_METRICS = ["acs", "kd", "winrate", "matches", "firstbloods", "clutches", "aces"] as const;
export type RankingMetric = (typeof RANKING_METRICS)[number];
export const DEFAULT_METRIC: RankingMetric = "acs";

export const METRIC_LABEL: Record<RankingMetric, string> = {
  acs: "ACS",
  kd: "K/D",
  winrate: "Vitórias",
  matches: "Partidas",
  firstbloods: "First bloods",
  clutches: "Clutches",
  aces: "Aces",
};

export function parseMetric(value: unknown): RankingMetric {
  return RANKING_METRICS.includes(value as RankingMetric) ? (value as RankingMetric) : DEFAULT_METRIC;
}

export function metricValue(summary: StatSummary, metric: RankingMetric, rounds?: PlayerRoundMetrics): number {
  switch (metric) {
    case "acs":
      return summary.acs;
    case "kd":
      return summary.kd;
    case "winrate":
      return summary.winRate.rate;
    case "matches":
      return summary.matches;
    case "firstbloods":
      return rounds?.firstBlood.successes ?? 0;
    case "clutches":
      return rounds ? Object.values(rounds.clutch).reduce((sum, value) => sum + value.wins, 0) : 0;
    case "aces":
      return rounds?.multiKills.ace ?? 0;
  }
}

export interface RankingEntry {
  member: GroupMember;
  summary: StatSummary;
  value: number;
  /** Same metric and mode last week; null when they didn't play then. */
  previous: number | null;
  roundSample: number | null;
}

export interface Ranking {
  mode: string;
  metric: RankingMetric;
  /** Members who played in the week, best first. */
  ranked: RankingEntry[];
  /** Members with no match in the week (or no Riot account), by name. */
  idle: GroupMember[];
}

const byName = (a: GroupMember, b: GroupMember) => a.name.localeCompare(b.name, "pt-BR");

function linesOf(lines: readonly GroupLine[], puuid: string, week: WeekRange, mode: string) {
  return filterByMode(
    lines.filter((l) => l.puuid === puuid && inWeek(l.startedAt, week)),
    mode,
  );
}

export function buildRanking(
  members: readonly GroupMember[],
  lines: readonly GroupLine[],
  opts: {
    week: WeekRange;
    previousWeek: WeekRange;
    mode?: string;
    metric?: RankingMetric;
    roundMetrics?: ReadonlyMap<string, PlayerRoundMetrics>;
    previousRoundMetrics?: ReadonlyMap<string, PlayerRoundMetrics>;
  },
): Ranking {
  const mode = opts.mode ?? DEFAULT_MODE;
  const metric = opts.metric ?? DEFAULT_METRIC;
  const ranked: RankingEntry[] = [];
  const idle: GroupMember[] = [];

  for (const member of members) {
    const mine = member.puuid ? linesOf(lines, member.puuid, opts.week, mode) : [];
    if (mine.length === 0) {
      idle.push(member);
      continue;
    }
    const summary = summarize(mine, { mode });
    const before = linesOf(lines, member.puuid!, opts.previousWeek, mode);
    const currentRounds = opts.roundMetrics?.get(member.puuid!);
    const previousRounds = opts.previousRoundMetrics?.get(member.puuid!);
    const isRoundMetric = metric === "firstbloods" || metric === "clutches" || metric === "aces";
    ranked.push({
      member,
      summary,
      value: metricValue(summary, metric, currentRounds),
      previous:
        before.length > 0 && (!isRoundMetric || (previousRounds?.rounds ?? 0) > 0)
          ? metricValue(summarize(before, { mode }), metric, previousRounds)
          : null,
      roundSample: isRoundMetric ? (currentRounds?.rounds ?? 0) : null,
    });
  }

  ranked.sort(
    (a, b) => b.value - a.value || b.summary.matches - a.summary.matches || byName(a.member, b.member),
  );
  return { mode, metric, ranked, idle: idle.sort(byName) };
}

/** Modes the members played in the week, competitive first, then "all" when 2+ were played. */
export function weekModes(lines: readonly GroupLine[], week: WeekRange): string[] {
  const counts = new Map<string, number>([[DEFAULT_MODE, 0]]);
  for (const l of lines) if (inWeek(l.startedAt, week)) counts.set(l.queueId, (counts.get(l.queueId) ?? 0) + 1);
  const modes = [...counts.entries()]
    .sort(([a, ca], [b, cb]) => (a === DEFAULT_MODE ? -1 : b === DEFAULT_MODE ? 1 : cb - ca))
    .map(([m]) => m);
  const played = [...counts.values()].filter((c) => c > 0).length;
  return played >= 2 ? [...modes, ALL_MODES] : modes;
}

/* ------------------------------------------------------------------ MVP -- */

export const MVP_MIN_MATCHES = 3;
/** Shown verbatim on the group page. */
export const MVP_RULE = `Maior ACS em partidas competitivas da semana, com pelo menos ${MVP_MIN_MATCHES} partidas. Empate: maior K/D.`;

export interface Mvp {
  member: GroupMember;
  summary: StatSummary;
}

/** The week's MVP by MVP_RULE, or null if nobody reached the minimum. */
export function weekMvp(members: readonly GroupMember[], lines: readonly GroupLine[], week: WeekRange): Mvp | null {
  let best: Mvp | null = null;
  for (const member of members) {
    if (!member.puuid) continue;
    const mine = linesOf(lines, member.puuid, week, DEFAULT_MODE);
    if (mine.length < MVP_MIN_MATCHES) continue;
    const summary = summarize(mine, { mode: DEFAULT_MODE });
    if (
      !best ||
      summary.acs > best.summary.acs ||
      (summary.acs === best.summary.acs && summary.kd > best.summary.kd) ||
      (summary.acs === best.summary.acs && summary.kd === best.summary.kd && byName(member, best.member) < 0)
    ) {
      best = { member, summary };
    }
  }
  return best;
}

/* ------------------------------------------------------------- together -- */

export interface TogetherPlayer {
  member: GroupMember;
  agentId: string | null;
  agentName: string | null;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
}

export interface TogetherMatch {
  matchId: string;
  startedAt: Date;
  queueId: string;
  mode: string | null;
  mapName: string | null;
  result: MatchResult;
  own: number;
  enemy: number;
  /** Members on that team, best ACS first. */
  players: TogetherPlayer[];
  /** Best ACS among them ("quem mandou bem"). */
  standout: TogetherPlayer;
}

/**
 * Matches where 2+ members played on the same team, newest first. Lines from
 * other matches or from non-members are ignored. Members on opposite teams in
 * the same match don't count as "together".
 */
export function togetherMatches(members: readonly GroupMember[], lines: readonly GroupLine[], limit = 10): TogetherMatch[] {
  const byPuuid = new Map(members.filter((m) => m.puuid).map((m) => [m.puuid!, m]));
  const sides = new Map<string, GroupLine[]>();
  for (const l of lines) {
    if (!byPuuid.has(l.puuid)) continue;
    const key = `${l.matchId}\u0000${l.team}`;
    const side = sides.get(key) ?? [];
    if (!side.some((s) => s.puuid === l.puuid)) side.push(l);
    sides.set(key, side);
  }

  const result: TogetherMatch[] = [];
  for (const side of sides.values()) {
    if (side.length < 2) continue;
    const first = side[0]!;
    const players = side
      .map(
        (l): TogetherPlayer => ({
          member: byPuuid.get(l.puuid)!,
          agentId: l.agentId,
          agentName: l.agentName,
          kills: l.kills,
          deaths: l.deaths,
          assists: l.assists,
          acs: acs(l.score, l.roundsPlayed),
        }),
      )
      .sort((a, b) => b.acs - a.acs || b.kills - a.kills || byName(a.member, b.member));
    const score = playerScore(first);
    result.push({
      matchId: first.matchId,
      startedAt: first.startedAt,
      queueId: first.queueId,
      mode: first.mode,
      mapName: first.mapName,
      result: matchResult(first),
      own: score.own,
      enemy: score.enemy,
      players,
      standout: players[0]!,
    });
  }
  return result.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()).slice(0, limit);
}
