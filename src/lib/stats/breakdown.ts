/**
 * Dashboard breakdowns over a player's match lines. Pure: the page passes
 * lines already loaded from match_players, newest first.
 *
 * Mode rule: callers filter by ONE mode (or explicitly by ALL_MODES) before
 * anything here runs, so every number on screen belongs to the selected mode.
 */
import { acs, adr, hsRate, kd } from "./metrics";
import { ALL_MODES, DEFAULT_MODE, filterByMode, matchResult, summarize, type PlayerMatchLine, type StatSummary } from "./aggregate";

export interface DashboardLine extends PlayerMatchLine {
  matchId: string;
  startedAt: Date;
  mapId: string | null;
  mapName: string | null;
  mode: string | null;
  agentId: string | null;
  agentName: string | null;
  team: string;
  redScore: number | null;
  blueScore: number | null;
}

/** How many recent matches the KPIs and trend use (SPEC §4). */
export const RECENT_WINDOW = 20;

export const PERIODS = ["30d", "90d", "all"] as const;
export type Period = (typeof PERIODS)[number];
export const DEFAULT_PERIOD: Period = "all";

const PERIOD_DAYS: Record<Exclude<Period, "all">, number> = { "30d": 30, "90d": 90 };

export function parsePeriod(value: unknown): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : DEFAULT_PERIOD;
}

export function filterByPeriod<T extends { startedAt: Date }>(lines: readonly T[], period: Period, now: Date): T[] {
  if (period === "all") return [...lines];
  const since = now.getTime() - PERIOD_DAYS[period] * 86_400_000;
  return lines.filter((l) => l.startedAt.getTime() >= since);
}

export interface ModeOption {
  value: string;
  matches: number;
}

/**
 * Modes the player actually has, most played first; competitive is always
 * offered (it's the default) and "all" comes last, explicitly.
 */
export function modeOptions(lines: readonly Pick<PlayerMatchLine, "queueId">[]): ModeOption[] {
  const counts = new Map<string, number>([[DEFAULT_MODE, 0]]);
  for (const l of lines) counts.set(l.queueId, (counts.get(l.queueId) ?? 0) + 1);
  const modes = [...counts.entries()]
    .map(([value, matches]) => ({ value, matches }))
    .sort((a, b) => (a.value === DEFAULT_MODE ? -1 : b.value === DEFAULT_MODE ? 1 : b.matches - a.matches));
  const played = modes.filter((m) => m.matches > 0).length;
  return played >= 2 ? [...modes, { value: ALL_MODES, matches: lines.length }] : modes;
}

/** Accepts only a mode from the options, else the default. */
export function parseMode(value: unknown, options: readonly ModeOption[]): string {
  return typeof value === "string" && options.some((o) => o.value === value) ? value : DEFAULT_MODE;
}

export interface RecentComparison {
  recent: StatSummary;
  overall: StatSummary;
  /** False when every match is inside the recent window (nothing to compare). */
  comparable: boolean;
}

/** Last N matches vs. the whole selection ("cada KPI comparando as últimas 20 com a média geral"). */
export function compareRecent(lines: readonly DashboardLine[], mode: string, window = RECENT_WINDOW): RecentComparison {
  const selected = filterByMode(lines, mode);
  return {
    recent: summarize(selected.slice(0, window), { mode }),
    overall: summarize(selected, { mode }),
    comparable: selected.length > window,
  };
}

export interface TrendPoint {
  /** 1 = oldest in the window. */
  match: number;
  matchId: string;
  startedAt: Date;
  acs: number;
  kd: number;
  /** Percent (0–100) for the chart axis. */
  hs: number;
  adr: number;
  won: boolean;
}

/** Per-match values for the trend chart, oldest → newest. */
export function trendSeries(lines: readonly DashboardLine[], window = RECENT_WINDOW): TrendPoint[] {
  return lines
    .slice(0, window)
    .reverse()
    .map((l, i) => ({
      match: i + 1,
      matchId: l.matchId,
      startedAt: l.startedAt,
      acs: acs(l.score, l.roundsPlayed),
      kd: kd(l.kills, l.deaths),
      hs: hsRate(l.headshots, l.bodyshots, l.legshots) * 100,
      adr: adr(l.damageDealt, l.roundsPlayed),
      won: l.won,
    }));
}

export interface GroupStats {
  key: string;
  name: string;
  id: string | null;
  summary: StatSummary;
}

function groupBy(
  lines: readonly DashboardLine[],
  mode: string,
  pick: (l: DashboardLine) => { name: string | null; id: string | null },
): GroupStats[] {
  const groups = new Map<string, { name: string; id: string | null; lines: DashboardLine[] }>();
  for (const l of lines) {
    const { name, id } = pick(l);
    const key = name ?? "?";
    const group = groups.get(key) ?? { name: name ?? "Desconhecido", id, lines: [] };
    group.lines.push(l);
    groups.set(key, group);
  }
  return [...groups.entries()]
    .map(([key, g]) => ({ key, name: g.name, id: g.id, summary: summarize(g.lines, { mode }) }))
    .sort((a, b) => b.summary.matches - a.summary.matches || b.summary.acs - a.summary.acs);
}

export const byAgent = (lines: readonly DashboardLine[], mode: string) =>
  groupBy(filterByMode(lines, mode), mode, (l) => ({ name: l.agentName, id: l.agentId }));

export const byMap = (lines: readonly DashboardLine[], mode: string) =>
  groupBy(filterByMode(lines, mode), mode, (l) => ({ name: l.mapName, id: l.mapId }));

/** The player's team rounds first: 13–9 means the player's team won 13. */
export function playerScore(line: Pick<DashboardLine, "team" | "redScore" | "blueScore">): { own: number; enemy: number } {
  const red = line.redScore ?? 0;
  const blue = line.blueScore ?? 0;
  return line.team.toLowerCase() === "red" ? { own: red, enemy: blue } : { own: blue, enemy: red };
}

export { matchResult };
