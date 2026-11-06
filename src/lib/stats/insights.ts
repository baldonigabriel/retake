/**
 * Automatic insights for /me ("seu HS% em Ascent tende a ficar 6 p.p. acima
 * da sua média"). Pure: takes the lines the dashboard already filtered by
 * mode and period, newest first.
 *
 * Guard rails against reading noise as a pattern:
 * - Nothing is said below INSIGHT_MIN_TOTAL matches in the selection.
 * - A segment (a map, an agent, a time of day) needs INSIGHT_MIN_SEGMENT
 *   matches, and so does everything outside it, the side it's compared to.
 * - The gap must clear a minimum size (MIN_GAP) AND be large next to the
 *   match-to-match variation: a Welch statistic on the per-match values,
 *   segment vs. the rest, of at least MIN_STRENGTH.
 * - Sentences say "tende a" / "costuma", never "você é".
 *
 * The numbers shown use the same volume-weighted formulas as the KPIs
 * (summarize), so an insight never contradicts a card on the same screen.
 */
import { formatNumber, formatPercent } from "@/lib/format";

import { summarize, type StatSummary } from "./aggregate";
import type { DashboardLine } from "./breakdown";
import { acs, hsRate } from "./metrics";

export const INSIGHT_MIN_TOTAL = 15;
export const INSIGHT_MIN_SEGMENT = 5;
/** Welch t on per-match values; ~1.5 keeps most coin-flip gaps out. */
export const MIN_STRENGTH = 1.5;
/** Smallest gap worth saying out loud, in the unit people read. */
export const MIN_GAP = {
  /** percentage points */
  hs: 3,
  /** percentage points */
  winrate: 15,
  /** fraction of the baseline ACS */
  acs: 0.08,
} as const;
export const MAX_INSIGHTS = 4;

export type InsightKind = "map-hs" | "map-winrate" | "agent-acs" | "time-winrate" | "time-acs";

export interface Insight {
  id: string;
  kind: InsightKind;
  /** "up" = better than usual, "down" = worse. Always shown with an icon, never colour alone. */
  tone: "up" | "down";
  /** The segment: "Ascent", "Jett", "à noite". */
  subject: string;
  /** Map or agent uuid, for the community icon; null for times of day. */
  subjectId: string | null;
  sentence: string;
  /** "7 de 18 partidas" */
  sample: string;
  strength: number;
}

export type InsightsResult =
  | { status: "too-few"; have: number; need: number }
  | { status: "none"; matches: number }
  | { status: "ok"; matches: number; insights: Insight[] };

/* ------------------------------------------------------------ helpers -- */

const TIME_ZONE = "America/Sao_Paulo";
const hourFormat = new Intl.DateTimeFormat("en-US", { timeZone: TIME_ZONE, hour: "numeric", hourCycle: "h23" });

export type DayPart = "madrugada" | "manha" | "tarde" | "noite";
const DAY_PART_PHRASE: Record<DayPart, string> = {
  madrugada: "de madrugada",
  manha: "de manhã",
  tarde: "à tarde",
  noite: "à noite",
};

/** Part of the day in São Paulo time: 0–6 madrugada, 6–12 manhã, 12–18 tarde, 18–24 noite. */
export function dayPart(date: Date): DayPart {
  const hour = Number(hourFormat.format(date)) % 24;
  if (hour < 6) return "madrugada";
  if (hour < 12) return "manha";
  if (hour < 18) return "tarde";
  return "noite";
}

function meanVar(values: readonly number[]) {
  const n = values.length;
  const mean = values.reduce((s, v) => s + v, 0) / n;
  const variance = n > 1 ? values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) : 0;
  return { n, mean, variance };
}

/** Welch statistic of a vs. b (signed). Large when the gap beats the spread. */
export function welch(a: readonly number[], b: readonly number[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const x = meanVar(a);
  const y = meanVar(b);
  const diff = x.mean - y.mean;
  // A floor on the error keeps identical matches (zero spread) from looking infinitely sure.
  const se = Math.sqrt(x.variance / x.n + y.variance / y.n);
  return diff / Math.max(se, 1e-6 + Math.abs(diff) * 0.05);
}

const perMatch = {
  hs: (l: DashboardLine) => hsRate(l.headshots, l.bodyshots, l.legshots),
  acs: (l: DashboardLine) => acs(l.score, l.roundsPlayed),
  win: (l: DashboardLine) => (l.won ? 1 : 0),
};

const pp = (ratio: number) => Math.round(ratio * 100);
const pct = (ratio: number) => formatPercent(ratio, 0);
const n = (value: number) => formatNumber(Math.round(value));
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

interface Segment {
  key: string;
  subject: string;
  subjectId: string | null;
  lines: DashboardLine[];
  rest: DashboardLine[];
}

function segments(lines: readonly DashboardLine[], pick: (l: DashboardLine) => { key: string | null; id: string | null }): Segment[] {
  const groups = new Map<string, { id: string | null; lines: DashboardLine[] }>();
  for (const l of lines) {
    const { key, id } = pick(l);
    if (!key) continue;
    const g = groups.get(key) ?? { id, lines: [] };
    g.lines.push(l);
    groups.set(key, g);
  }
  return [...groups.entries()]
    .filter(([, g]) => g.lines.length >= INSIGHT_MIN_SEGMENT && lines.length - g.lines.length >= INSIGHT_MIN_SEGMENT)
    .map(([key, g]) => {
      const inside = new Set(g.lines);
      return { key, subject: key, subjectId: g.id, lines: g.lines, rest: lines.filter((l) => !inside.has(l)) };
    });
}

/* ----------------------------------------------------------- builders -- */

type Candidate = Omit<Insight, "id" | "sample"> & { segment: Segment };

function mapHs(seg: Segment, overall: StatSummary): Candidate | null {
  const mine = summarize(seg.lines, { mode: overall.mode });
  const gap = pp(mine.hsRate) - pp(overall.hsRate);
  const strength = welch(seg.lines.map(perMatch.hs), seg.rest.map(perMatch.hs));
  if (Math.abs(gap) < MIN_GAP.hs || Math.abs(strength) < MIN_STRENGTH || Math.sign(gap) !== Math.sign(strength)) return null;
  const up = gap > 0;
  return {
    kind: "map-hs",
    tone: up ? "up" : "down",
    subject: seg.subject,
    subjectId: seg.subjectId,
    segment: seg,
    strength: Math.abs(strength),
    sentence: up
      ? `Seu HS% em ${seg.subject} tende a ficar ${Math.abs(gap)} p.p. acima da sua média (${pct(mine.hsRate)} contra ${pct(overall.hsRate)}).`
      : `Em ${seg.subject}, seu HS% costuma ficar ${Math.abs(gap)} p.p. abaixo da sua média (${pct(mine.hsRate)} contra ${pct(overall.hsRate)}).`,
  };
}

function mapWinrate(seg: Segment, overall: StatSummary): Candidate | null {
  const mine = summarize(seg.lines, { mode: overall.mode });
  const gap = pp(mine.winRate.rate) - pp(overall.winRate.rate);
  const strength = welch(seg.lines.map(perMatch.win), seg.rest.map(perMatch.win));
  if (Math.abs(gap) < MIN_GAP.winrate || Math.abs(strength) < MIN_STRENGTH || Math.sign(gap) !== Math.sign(strength)) return null;
  const up = gap > 0;
  const record = `${mine.winRate.wins} de ${mine.matches}`;
  return {
    kind: "map-winrate",
    tone: up ? "up" : "down",
    subject: seg.subject,
    subjectId: seg.subjectId,
    segment: seg,
    strength: Math.abs(strength),
    sentence: up
      ? `Você tende a vencer mais em ${seg.subject}: ${record} partidas (${pct(mine.winRate.rate)}), contra ${pct(overall.winRate.rate)} no geral.`
      : `Em ${seg.subject} as vitórias têm sido mais raras: ${record} partidas (${pct(mine.winRate.rate)}), contra ${pct(overall.winRate.rate)} no geral.`,
  };
}

function agentAcs(seg: Segment, overall: StatSummary): Candidate | null {
  const mine = summarize(seg.lines, { mode: overall.mode });
  const gap = Math.round(mine.acs) - Math.round(overall.acs);
  const strength = welch(seg.lines.map(perMatch.acs), seg.rest.map(perMatch.acs));
  if (Math.abs(gap) < overall.acs * MIN_GAP.acs || Math.abs(strength) < MIN_STRENGTH || Math.sign(gap) !== Math.sign(strength)) return null;
  const up = gap > 0;
  return {
    kind: "agent-acs",
    tone: up ? "up" : "down",
    subject: seg.subject,
    subjectId: seg.subjectId,
    segment: seg,
    strength: Math.abs(strength),
    sentence: up
      ? `Com ${seg.subject}, seu ACS costuma ser maior: ${n(mine.acs)}, contra ${n(overall.acs)} na sua média.`
      : `Com ${seg.subject}, seu ACS costuma ficar abaixo: ${n(mine.acs)}, contra ${n(overall.acs)} na sua média.`,
  };
}

function timeWinrate(seg: Segment, overall: StatSummary): Candidate | null {
  const mine = summarize(seg.lines, { mode: overall.mode });
  const rest = summarize(seg.rest, { mode: overall.mode });
  const gap = pp(mine.winRate.rate) - pp(rest.winRate.rate);
  const strength = welch(seg.lines.map(perMatch.win), seg.rest.map(perMatch.win));
  if (Math.abs(gap) < MIN_GAP.winrate || Math.abs(strength) < MIN_STRENGTH || Math.sign(gap) !== Math.sign(strength)) return null;
  const up = gap > 0;
  const when = seg.subject;
  return {
    kind: "time-winrate",
    tone: up ? "up" : "down",
    subject: when,
    subjectId: null,
    segment: seg,
    strength: Math.abs(strength),
    sentence: up
      ? `Você tende a vencer mais jogando ${when}: ${pct(mine.winRate.rate)} das partidas, contra ${pct(rest.winRate.rate)} nos outros horários.`
      : `Jogando ${when}, você tende a vencer menos: ${pct(mine.winRate.rate)} das partidas, contra ${pct(rest.winRate.rate)} nos outros horários.`,
  };
}

function timeAcs(seg: Segment, overall: StatSummary): Candidate | null {
  const mine = summarize(seg.lines, { mode: overall.mode });
  const rest = summarize(seg.rest, { mode: overall.mode });
  const gap = Math.round(mine.acs) - Math.round(rest.acs);
  const strength = welch(seg.lines.map(perMatch.acs), seg.rest.map(perMatch.acs));
  if (Math.abs(gap) < rest.acs * MIN_GAP.acs || Math.abs(strength) < MIN_STRENGTH || Math.sign(gap) !== Math.sign(strength)) return null;
  const up = gap > 0;
  const when = seg.subject;
  return {
    kind: "time-acs",
    tone: up ? "up" : "down",
    subject: when,
    subjectId: null,
    segment: seg,
    strength: Math.abs(strength),
    sentence: up
      ? `Seu ACS costuma ser mais alto ${when}: ${n(mine.acs)}, contra ${n(rest.acs)} nos outros horários.`
      : `${when[0]!.toUpperCase()}${when.slice(1)}, seu ACS costuma cair: ${n(mine.acs)}, contra ${n(rest.acs)} nos outros horários.`,
  };
}

/* --------------------------------------------------------------- main -- */

/**
 * Insights for the selection (one mode, or ALL_MODES chosen explicitly by the
 * user), strongest first, at most one per segment and MAX_INSIGHTS in total.
 */
export function buildInsights(lines: readonly DashboardLine[], mode: string, max = MAX_INSIGHTS): InsightsResult {
  if (lines.length < INSIGHT_MIN_TOTAL) return { status: "too-few", have: lines.length, need: INSIGHT_MIN_TOTAL };
  const overall = summarize(lines, { mode });

  const maps = segments(lines, (l) => ({ key: l.mapName, id: l.mapId }));
  const agents = segments(lines, (l) => ({ key: l.agentName, id: l.agentId }));
  const times = segments(lines, (l) => ({ key: DAY_PART_PHRASE[dayPart(l.startedAt)], id: null }));

  const candidates: Candidate[] = [
    ...maps.flatMap((s) => [mapHs(s, overall), mapWinrate(s, overall)]),
    ...agents.map((s) => agentAcs(s, overall)),
    ...times.flatMap((s) => [timeWinrate(s, overall), timeAcs(s, overall)]),
  ].filter((c): c is Candidate => c !== null);

  candidates.sort((a, b) => b.strength - a.strength || a.kind.localeCompare(b.kind) || a.subject.localeCompare(b.subject));

  const used = new Set<string>();
  const insights: Insight[] = [];
  for (const c of candidates) {
    const family = c.kind.split("-")[0]!;
    const segmentKey = `${family}:${c.segment.key}`;
    if (used.has(segmentKey)) continue;
    // Times of day are complementary ("vence mais à noite" ≈ "vence menos à tarde"): say one.
    if (family === "time" && used.has("time")) continue;
    used.add(segmentKey);
    if (family === "time") used.add("time");
    const { segment, ...rest } = c;
    insights.push({
      ...rest,
      id: `${c.kind}:${segment.key}`,
      sample: `${plural(segment.lines.length, "partida", "partidas")} de ${lines.length}`,
    });
    if (insights.length >= max) break;
  }

  return insights.length > 0 ? { status: "ok", matches: lines.length, insights } : { status: "none", matches: lines.length };
}
