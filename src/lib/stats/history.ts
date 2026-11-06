/**
 * Match history ("Últimas partidas"): the summary of the latest matches and
 * the list grouped by day. Pure; days are São Paulo days (DISPLAY_TIME_ZONE).
 *
 * RR rule: RR only exists for competitive matches, and only when the rank
 * history linked a snapshot to the match. A day's RR total is shown only when
 * every competitive match that day has its RR; otherwise it's unknown (null),
 * never a partial sum passed off as the whole day.
 */
import { DISPLAY_TIME_ZONE } from "@/lib/format";

import { matchResult } from "./aggregate";
import { agentSlug, agentStats, performance, type AgentLine, type AgentStats, type PerformanceStats } from "./agents";
import type { MatchResult } from "./metrics";

export const HISTORY_SUMMARY_WINDOW = 20;
export const HISTORY_PAGE = 20;
export const TOP_AGENTS = 3;
/** "Carregar mais" grows the list in pages; the URL keeps how many are shown. */
export const HISTORY_MAX = 500;

/** ?show= → a whole number of pages between 1 page and HISTORY_MAX. */
export function parseShow(value: unknown): number {
  const n = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  if (!Number.isFinite(n) || n <= HISTORY_PAGE) return HISTORY_PAGE;
  return Math.min(HISTORY_MAX, Math.ceil(n / HISTORY_PAGE) * HISTORY_PAGE);
}

export interface HistoryLine extends AgentLine {
  startedAt: Date;
  /** RR won or lost; null when unknown or not competitive */
  rrChange: number | null;
}

export interface HistorySummary {
  stats: PerformanceStats;
  /** Most played agents in the window (max 3), each with its own numbers */
  topAgents: AgentStats[];
}

/** Summary of the newest `window` lines (lines come newest first). */
export function historySummary(lines: readonly AgentLine[], window = HISTORY_SUMMARY_WINDOW): HistorySummary {
  const recent = lines.slice(0, window);
  return { stats: performance(recent), topAgents: agentStats(recent).slice(0, TOP_AGENTS) };
}

const dayFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "2026-11-06": the São Paulo calendar day of an instant. */
export function dayKey(date: Date): string {
  return dayFormat.format(date);
}

/** "Hoje", "Ontem", or "qua., 4 de nov." (with the year when it isn't this year). */
export function dayLabel(key: string, now: Date): string {
  const today = dayKey(now);
  if (key === today) return "Hoje";
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000));
  // DST-free in São Paulo since 2019, but compare keys anyway, not offsets.
  if (key === yesterday) return "Ontem";
  const [y, m, d] = key.split("-").map(Number) as [number, number, number];
  const noon = new Date(Date.UTC(y, m - 1, d, 15)); // 12:00 in São Paulo
  return noon
    .toLocaleDateString("pt-BR", {
      timeZone: DISPLAY_TIME_ZONE,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: key.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric",
    })
    .replace(/\.$/, "");
}

export interface HistoryDay<T> {
  key: string;
  label: string;
  wins: number;
  losses: number;
  draws: number;
  /** Sum of the day's RR; null when a competitive match lacks its RR */
  rr: number | null;
  /** Competitive matches that day (RR only exists for them) */
  competitive: number;
  items: T[];
}

/** Consecutive items (newest first) grouped by São Paulo day, with the day's balance. */
export function groupByDay<T extends Pick<HistoryLine, "startedAt" | "won" | "winningTeam" | "queueId" | "rrChange">>(
  items: readonly T[],
  now: Date,
): HistoryDay<T>[] {
  const days: HistoryDay<T>[] = [];
  for (const item of items) {
    const key = dayKey(item.startedAt);
    let day = days.at(-1);
    if (!day || day.key !== key) {
      day = { key, label: dayLabel(key, now), wins: 0, losses: 0, draws: 0, rr: 0, competitive: 0, items: [] };
      days.push(day);
    }
    day.items.push(item);
    const result: MatchResult = matchResult(item);
    if (result === "win") day.wins++;
    else if (result === "loss") day.losses++;
    else day.draws++;
    if (item.queueId === "competitive") {
      day.competitive++;
      day.rr = day.rr === null || item.rrChange === null ? null : day.rr + item.rrChange;
    }
  }
  return days;
}

export interface HistoryOption {
  value: string;
  label: string;
}

const optionsBy = (lines: readonly AgentLine[], name: (l: AgentLine) => string | null): HistoryOption[] => {
  const counts = new Map<string, { label: string; n: number }>();
  for (const l of lines) {
    const label = name(l);
    if (!label) continue;
    const value = agentSlug(label);
    const entry = counts.get(value);
    if (entry) entry.n++;
    else counts.set(value, { label, n: 1 });
  }
  return [...counts.entries()]
    .sort(([, a], [, b]) => b.n - a.n || a.label.localeCompare(b.label, "pt-BR"))
    .map(([value, { label }]) => ({ value, label }));
};

/** Agents and maps present in `lines`, most played first (values are URL slugs). */
export function historyOptions(lines: readonly AgentLine[]): { agents: HistoryOption[]; maps: HistoryOption[] } {
  return { agents: optionsBy(lines, (l) => l.agentName), maps: optionsBy(lines, (l) => l.mapName) };
}

/** Keeps a filter only when it matches an option; anything else means "all". */
export function parseHistoryFilter(value: unknown, options: readonly HistoryOption[]): string | undefined {
  return typeof value === "string" && options.some((o) => o.value === value) ? value : undefined;
}

export function filterHistory<T extends AgentLine>(lines: readonly T[], filters: { agent?: string; map?: string }): T[] {
  return lines.filter(
    (l) =>
      (!filters.agent || (l.agentName !== null && agentSlug(l.agentName) === filters.agent)) &&
      (!filters.map || (l.mapName !== null && agentSlug(l.mapName) === filters.map)),
  );
}
