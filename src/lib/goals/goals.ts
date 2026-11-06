/**
 * Personal weekly goals ("HS% acima de 25% nesta semana"). Pure.
 *
 * - A goal is a metric and a target; it repeats every week (Monday–Sunday,
 *   São Paulo) until the player removes it. One goal per metric.
 * - Progress is computed from the week's COMPETITIVE matches only, with the
 *   same formulas as the dashboard; nothing is stored but the target.
 * - Rate goals (HS%, ACS, K/D, ADR, win rate) only count as reached with at
 *   least GOAL_MIN_MATCHES matches: one lucky game isn't a week.
 */
import { z } from "zod";

import { formatNumber } from "@/lib/format";
import { DEFAULT_MODE, filterByMode, summarize, type PlayerMatchLine, type StatSummary } from "@/lib/stats/aggregate";

export const GOAL_METRICS = ["hs", "acs", "kd", "adr", "winrate", "matches"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];

export const MAX_GOALS = 3;
export const GOAL_MIN_MATCHES = 3;
export const GOAL_MODE = DEFAULT_MODE;

interface MetricSpec {
  /** Select label. */
  name: string;
  min: number;
  max: number;
  step: number;
  /** Suggested target in the form. */
  suggested: number;
  /** Unit after the input ("%", "") */
  unit: string;
  /** Decimal places shown. */
  digits: number;
}

/** Targets are stored in the unit people type: HS% 25 means 25%, K/D 1.2 means 1,20. */
export const GOAL_SPEC: Record<GoalMetric, MetricSpec> = {
  hs: { name: "HS%", min: 1, max: 80, step: 1, suggested: 25, unit: "%", digits: 0 },
  acs: { name: "ACS", min: 50, max: 500, step: 5, suggested: 220, unit: "", digits: 0 },
  kd: { name: "K/D", min: 0.3, max: 5, step: 0.05, suggested: 1.1, unit: "", digits: 2 },
  adr: { name: "ADR", min: 30, max: 300, step: 5, suggested: 140, unit: "", digits: 0 },
  winrate: { name: "Vitórias", min: 5, max: 100, step: 5, suggested: 55, unit: "%", digits: 0 },
  matches: { name: "Partidas jogadas", min: 1, max: 100, step: 1, suggested: 10, unit: "", digits: 0 },
};

/** Accepts "25", "25,5", "1.2"; rounds to the metric's step precision. */
export const goalInputSchema = z
  .object({
    metric: z.enum(GOAL_METRICS, { error: "Escolha uma métrica." }),
    target: z.union([z.number(), z.string()]),
  })
  .transform((v, ctx) => {
    const raw = typeof v.target === "number" ? v.target : Number(v.target.trim().replace(",", "."));
    const spec = GOAL_SPEC[v.metric];
    if (!Number.isFinite(raw) || (typeof v.target === "string" && v.target.trim() === "")) {
      ctx.addIssue({ code: "custom", path: ["target"], message: "Digite um número." });
      return z.NEVER;
    }
    if (raw < spec.min || raw > spec.max) {
      ctx.addIssue({
        code: "custom",
        path: ["target"],
        message: `Use um valor entre ${formatTarget(v.metric, spec.min)} e ${formatTarget(v.metric, spec.max)}.`,
      });
      return z.NEVER;
    }
    const factor = 10 ** spec.digits;
    return { metric: v.metric, target: Math.round(raw * factor) / factor };
  });

export type GoalInput = z.output<typeof goalInputSchema>;

export function formatTarget(metric: GoalMetric, value: number): string {
  const spec = GOAL_SPEC[metric];
  return `${formatNumber(value, spec.digits)}${spec.unit}`;
}

/** "HS% acima de 25%", "Vencer 60% das partidas", "Jogar 10 partidas". */
export function goalLabel(metric: GoalMetric, target: number): string {
  const t = formatTarget(metric, target);
  switch (metric) {
    case "winrate":
      return `Vencer ${t} das partidas`;
    case "matches":
      return `Jogar ${t} ${target === 1 ? "partida" : "partidas"}`;
    default:
      return `${GOAL_SPEC[metric].name} acima de ${t}`;
  }
}

/** The week's value in the goal's unit (HS% as 0–100, like the target). */
export function goalValue(metric: GoalMetric, summary: StatSummary): number {
  switch (metric) {
    case "hs":
      return summary.hsRate * 100;
    case "acs":
      return summary.acs;
    case "kd":
      return summary.kd;
    case "adr":
      return summary.adr;
    case "winrate":
      return summary.winRate.rate * 100;
    case "matches":
      return summary.matches;
  }
}

export type GoalStatus =
  /** No competitive match this week yet. */
  | "not-started"
  /** Rate goal with fewer than GOAL_MIN_MATCHES matches: provisional. */
  | "provisional"
  | "reached"
  | "below";

export interface GoalProgress {
  metric: GoalMetric;
  target: number;
  label: string;
  matches: number;
  /** Null before the first match of the week. */
  value: number | null;
  /** 0–1, for the bar. */
  ratio: number;
  status: GoalStatus;
  /** One line under the bar, in plain words. */
  note: string;
}

/** How far from the target, in words: "4 p.p.", "12 de ACS", "0,15 de K/D". */
function gapText(metric: GoalMetric, gap: number): string {
  const spec = GOAL_SPEC[metric];
  const n = formatNumber(Math.max(gap, 10 ** -spec.digits), spec.digits);
  return spec.unit === "%" ? `${n} p.p.` : `${n} de ${spec.name}`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function evaluateGoal(goal: { metric: GoalMetric; target: number }, weekLines: readonly PlayerMatchLine[]): GoalProgress {
  const lines = filterByMode(weekLines, GOAL_MODE);
  const summary = summarize(lines, { mode: GOAL_MODE });
  const label = goalLabel(goal.metric, goal.target);
  const base = { metric: goal.metric, target: goal.target, label, matches: summary.matches };

  if (summary.matches === 0) {
    return {
      ...base,
      value: goal.metric === "matches" ? 0 : null,
      ratio: 0,
      status: "not-started",
      note: "Nenhuma partida competitiva nesta semana ainda.",
    };
  }

  const value = goalValue(goal.metric, summary);
  const shown = formatTarget(goal.metric, value);
  const ratio = Math.max(0, Math.min(1, value / goal.target));
  // Compare what's on screen: 24,6% shows as 25% and must not read "abaixo de 25%".
  const factor = 10 ** GOAL_SPEC[goal.metric].digits;
  const reached = Math.round(value * factor) >= Math.round(goal.target * factor);

  if (goal.metric === "matches") {
    const left = goal.target - summary.matches;
    return {
      ...base,
      value,
      ratio,
      status: reached ? "reached" : "below",
      note: reached ? "Meta batida. Bom ritmo." : `Faltam ${plural(left, "partida", "partidas")}.`,
    };
  }

  if (summary.matches < GOAL_MIN_MATCHES) {
    const left = GOAL_MIN_MATCHES - summary.matches;
    return {
      ...base,
      value,
      ratio,
      status: "provisional",
      note: `${shown} em ${plural(summary.matches, "partida", "partidas")}. Jogue mais ${left} para valer.`,
    };
  }

  return {
    ...base,
    value,
    ratio,
    status: reached ? "reached" : "below",
    note: reached
      ? `Meta batida em ${plural(summary.matches, "partida", "partidas")}.`
      : `Faltam ${gapText(goal.metric, goal.target - value)} (${plural(summary.matches, "partida", "partidas")} na semana).`,
  };
}
