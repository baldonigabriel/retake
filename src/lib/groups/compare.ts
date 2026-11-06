/**
 * 1x1 comparison between two members of the same group. Pure: the page
 * resolves membership, loads lines for exactly these two puuids and passes
 * them here.
 *
 * Privacy (CLAUDE.md): only app users who are members of the group, with a
 * linked Riot account, can be picked. Ids from the URL that aren't in that
 * list are ignored, never looked up.
 */
import { DEFAULT_MODE, filterByMode, summarize, type StatSummary } from "@/lib/stats/aggregate";

import { togetherMatches, type GroupLine, type GroupMember, type TogetherMatch } from "./ranking";

export const COMPARE_PERIODS = ["week", "30d", "all"] as const;
export type ComparePeriod = (typeof COMPARE_PERIODS)[number];
export const DEFAULT_COMPARE_PERIOD: ComparePeriod = "30d";

export function parseComparePeriod(value: unknown): ComparePeriod {
  return COMPARE_PERIODS.includes(value as ComparePeriod) ? (value as ComparePeriod) : DEFAULT_COMPARE_PERIOD;
}

/** Below this many matches, a side is flagged as a small sample. */
export const SMALL_SAMPLE = 5;

export type ComparableMember = GroupMember & { puuid: string };

export function comparable(members: readonly GroupMember[]): ComparableMember[] {
  return members.filter((m): m is ComparableMember => m.puuid !== null);
}

/**
 * The pair to show: `a` and `b` from the URL when they're comparable members
 * and different; otherwise the viewer (or the first member) and the next one.
 * Null when fewer than two members can be compared.
 */
export function resolvePair(
  members: readonly ComparableMember[],
  query: { a?: unknown; b?: unknown },
): { a: ComparableMember; b: ComparableMember } | null {
  if (members.length < 2) return null;
  const find = (id: unknown) => (typeof id === "string" ? members.find((m) => m.userId === id) : undefined);
  const a = find(query.a) ?? members.find((m) => m.isYou) ?? members[0]!;
  const askedB = find(query.b);
  const b = askedB && askedB.userId !== a.userId ? askedB : members.find((m) => m.userId !== a.userId)!;
  return { a, b };
}

export const COMPARE_METRICS = ["acs", "kd", "hs", "adr", "winrate"] as const;
export type CompareMetric = (typeof COMPARE_METRICS)[number];

export const COMPARE_LABEL: Record<CompareMetric, string> = {
  acs: "ACS",
  kd: "K/D",
  hs: "HS%",
  adr: "ADR",
  winrate: "Vitórias",
};

export function compareValue(summary: StatSummary, metric: CompareMetric): number {
  switch (metric) {
    case "acs":
      return summary.acs;
    case "kd":
      return summary.kd;
    case "hs":
      return summary.hsRate;
    case "adr":
      return summary.adr;
    case "winrate":
      return summary.winRate.rate;
  }
}

/** Value as shown on screen; leaders are decided on this, so "2,10 vs 2,10" is a tie. */
export function displayedValue(metric: CompareMetric, value: number): number {
  switch (metric) {
    case "acs":
    case "adr":
      return Math.round(value);
    case "kd":
      return Math.round(value * 100) / 100;
    case "hs":
    case "winrate":
      return Math.round(value * 100);
  }
}

export interface CompareRow {
  metric: CompareMetric;
  a: number | null;
  b: number | null;
  leader: "a" | "b" | null;
}

export interface Side {
  member: ComparableMember;
  summary: StatSummary;
  /** Most played agent in the selection. */
  topAgent: { name: string; id: string | null; matches: number } | null;
}

export interface Comparison {
  mode: string;
  a: Side;
  b: Side;
  rows: CompareRow[];
  /** Matches both played on the same team, newest first. */
  together: TogetherMatch[];
  /** In those matches: who had the higher ACS, and the record. */
  togetherRecord: { wins: number; losses: number; draws: number; aBetter: number; bBetter: number };
}

function topAgent(lines: readonly GroupLine[]): Side["topAgent"] {
  const counts = new Map<string, { id: string | null; matches: number }>();
  for (const l of lines) {
    if (!l.agentName) continue;
    const c = counts.get(l.agentName) ?? { id: l.agentId, matches: 0 };
    c.matches++;
    counts.set(l.agentName, c);
  }
  const best = [...counts.entries()].sort(([an, a], [bn, b]) => b.matches - a.matches || an.localeCompare(bn))[0];
  return best ? { name: best[0], id: best[1].id, matches: best[1].matches } : null;
}

export function compareMembers(
  a: ComparableMember,
  b: ComparableMember,
  lines: readonly GroupLine[],
  mode: string = DEFAULT_MODE,
): Comparison {
  const selected = filterByMode(lines, mode);
  const linesA = selected.filter((l) => l.puuid === a.puuid);
  const linesB = selected.filter((l) => l.puuid === b.puuid);
  const sa = summarize(linesA, { mode });
  const sb = summarize(linesB, { mode });

  const rows = COMPARE_METRICS.map((metric): CompareRow => {
    const va = sa.matches > 0 ? compareValue(sa, metric) : null;
    const vb = sb.matches > 0 ? compareValue(sb, metric) : null;
    let leader: CompareRow["leader"] = null;
    if (va !== null && vb !== null) {
      const da = displayedValue(metric, va);
      const db = displayedValue(metric, vb);
      leader = da > db ? "a" : db > da ? "b" : null;
    }
    return { metric, a: va, b: vb, leader };
  });

  const together = togetherMatches([a, b], selected, Number.MAX_SAFE_INTEGER);
  const record = { wins: 0, losses: 0, draws: 0, aBetter: 0, bBetter: 0 };
  for (const m of together) {
    if (m.result === "win") record.wins++;
    else if (m.result === "loss") record.losses++;
    else record.draws++;
    const pa = m.players.find((p) => p.member.userId === a.userId);
    const pb = m.players.find((p) => p.member.userId === b.userId);
    if (pa && pb && Math.round(pa.acs) !== Math.round(pb.acs)) {
      if (pa.acs > pb.acs) record.aBetter++;
      else record.bBetter++;
    }
  }

  return {
    mode,
    a: { member: a, summary: sa, topAgent: topAgent(linesA) },
    b: { member: b, summary: sb, topAgent: topAgent(linesB) },
    rows,
    together,
    togetherRecord: record,
  };
}
