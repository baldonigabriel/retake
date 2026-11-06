/** Display formatting for the group ranking (pt-BR, pure). */
import { formatNumber } from "@/lib/format";
import type { StatSummary } from "@/lib/stats/aggregate";

import type { RankingMetric } from "./ranking";

/** A metric as it is shown: the number, its decimal places and unit. */
export type ShownNumber = { value: number; digits: number; suffix?: string };

export function metricNumber(metric: RankingMetric, value: number): ShownNumber {
  switch (metric) {
    case "acs":
      return { value: Math.round(value), digits: 0 };
    case "kd":
      return { value, digits: 2 };
    case "winrate":
      return { value: value * 100, digits: 0, suffix: "%" };
    case "matches":
      return { value, digits: 0 };
  }
}

export function formatMetric(metric: RankingMetric, value: number): string {
  const shown = metricNumber(metric, value);
  return `${formatNumber(shown.value, shown.digits)}${shown.suffix ?? ""}`;
}

/** Change vs. last week, in the unit people read: win rate in percentage points. */
export function metricDelta(metric: RankingMetric, value: number, previous: number | null) {
  const digits = metric === "kd" ? 2 : 0;
  if (previous === null) return { delta: null, digits, suffix: undefined };
  if (metric === "winrate") return { delta: (value - previous) * 100, digits, suffix: " p.p." };
  if (metric === "acs") return { delta: Math.round(value) - Math.round(previous), digits, suffix: undefined };
  return { delta: value - previous, digits, suffix: undefined };
}

/** "4 partidas · 3V 1D" (draws only when there are any). */
export function recordLine(summary: StatSummary): string {
  const { wins, losses, draws } = summary.winRate;
  const record = `${wins}V ${losses}D${draws > 0 ? ` ${draws}E` : ""}`;
  return `${summary.matches} ${summary.matches === 1 ? "partida" : "partidas"} · ${record}`;
}
