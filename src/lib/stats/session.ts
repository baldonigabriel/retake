/**
 * Play sessions: matches in a row with at most SESSION_GAP_MS between the end
 * of one and the start of the next. Pure; the caller passes the viewer's own
 * lines (any order, any mode).
 *
 * A session is about time, not mode: an unrated warm-up followed by ranked is
 * one session. Averages over a session therefore can mix modes, and the
 * summary reports which modes it has so the UI can say so.
 *
 * RR follows the history rule (src/lib/stats/history.ts): it only exists for
 * competitive matches with a linked snapshot. The summary sums the known RR
 * and says how many competitive matches still lack it, never estimating.
 */
import { dayKey } from "./history";
import { matchResult, type PlayerMatchLine } from "./aggregate";
import { acs, kd, type MatchResult } from "./metrics";

/** Up to 2 hours between the end of a match and the start of the next. */
export const SESSION_GAP_MS = 2 * 60 * 60 * 1000;
/** Losses in a row, in the session still going on, before the gentle "take a break" note. */
export const TILT_STREAK = 3;

export interface SessionLine {
  matchId: string;
  startedAt: Date;
  /** null when the API didn't report it: the match then "ends" when it started. */
  gameLengthMs: number | null;
}

export function matchEnd(line: SessionLine): Date {
  return new Date(line.startedAt.getTime() + Math.max(0, line.gameLengthMs ?? 0));
}

const byStart = <T extends SessionLine>(a: T, b: T) =>
  a.startedAt.getTime() - b.startedAt.getTime() || a.matchId.localeCompare(b.matchId);

/**
 * Sessions newest first; inside each one, matches oldest → newest (the order
 * they were played). The gap is measured from the latest end seen so far, so
 * a long match that overlaps the next one (clock drift) never splits it.
 */
export function splitSessions<T extends SessionLine>(lines: readonly T[], gapMs = SESSION_GAP_MS): T[][] {
  const sorted = [...lines].sort(byStart);
  const sessions: T[][] = [];
  let current: T[] = [];
  let lastEnd = Number.NEGATIVE_INFINITY;
  for (const line of sorted) {
    if (current.length > 0 && line.startedAt.getTime() - lastEnd > gapMs) {
      sessions.push(current);
      current = [];
      lastEnd = Number.NEGATIVE_INFINITY;
    }
    current.push(line);
    lastEnd = Math.max(lastEnd, matchEnd(line).getTime());
  }
  if (current.length > 0) sessions.push(current);
  return sessions.reverse();
}

export interface CurrentSession<T> {
  /** Oldest → newest. */
  lines: T[];
  startedAt: Date;
  endedAt: Date;
  /**
   * Still within the gap: another match now would join this session. Only an
   * ongoing session can show the tilt note (a finished one is history).
   */
  ongoing: boolean;
}

/**
 * The session for "Sessão de hoje": the latest one, while it's still going
 * on (last match ended ≤ gap ago) or when it ended today (São Paulo day).
 * Null otherwise: yesterday's session isn't "today".
 */
export function currentSession<T extends SessionLine>(
  lines: readonly T[],
  now: Date,
  gapMs = SESSION_GAP_MS,
): CurrentSession<T> | null {
  const latest = splitSessions(lines, gapMs)[0];
  if (!latest) return null;
  const startedAt = latest[0]!.startedAt;
  const endedAt = new Date(Math.max(...latest.map((l) => matchEnd(l).getTime())));
  // A match "in the future" (clock skew) still counts as going on.
  const ongoing = now.getTime() - endedAt.getTime() <= gapMs;
  if (!ongoing && dayKey(endedAt) !== dayKey(now)) return null;
  return { lines: latest, startedAt, endedAt, ongoing };
}

export interface SessionMatchLine extends SessionLine, PlayerMatchLine {
  /** RR won or lost; null when unknown or not competitive. */
  rrChange: number | null;
}

export interface SessionSummary<T> {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  /** Sum of the RR we know (competitive matches with a snapshot). */
  rr: number;
  /** Competitive matches in the session (the only ones with RR). */
  competitive: number;
  /** Competitive matches whose RR hasn't arrived yet (not in `rr`). */
  rrMissing: number;
  /** Volume-weighted over the whole session; may mix modes (see `modes`). */
  acs: number;
  kd: number;
  /** Distinct queue ids, in play order. More than one means averages mix modes. */
  modes: string[];
  /** Highest ACS; ties: higher K/D, then the later match. */
  best: T | null;
  /** Losses in a row at the end of the session (a draw or a win breaks it). */
  lossStreak: number;
}

/** Numbers for the "Sessão de hoje" card. `lines` in any order. */
export function summarizeSession<T extends SessionMatchLine>(lines: readonly T[]): SessionSummary<T> {
  const ordered = [...lines].sort(byStart);
  const s: SessionSummary<T> = {
    matches: ordered.length,
    wins: 0,
    losses: 0,
    draws: 0,
    rr: 0,
    competitive: 0,
    rrMissing: 0,
    acs: 0,
    kd: 0,
    modes: [],
    best: null,
    lossStreak: 0,
  };
  let score = 0;
  let rounds = 0;
  let kills = 0;
  let deaths = 0;
  let bestAcs = Number.NEGATIVE_INFINITY;
  let bestKd = Number.NEGATIVE_INFINITY;

  for (const l of ordered) {
    const result: MatchResult = matchResult(l);
    if (result === "win") s.wins++;
    else if (result === "loss") s.losses++;
    else s.draws++;
    s.lossStreak = result === "loss" ? s.lossStreak + 1 : 0;

    if (l.queueId === "competitive") {
      s.competitive++;
      if (l.rrChange === null) s.rrMissing++;
      else s.rr += l.rrChange;
    }
    if (!s.modes.includes(l.queueId)) s.modes.push(l.queueId);

    score += l.score;
    rounds += l.roundsPlayed;
    kills += l.kills;
    deaths += l.deaths;

    const a = acs(l.score, l.roundsPlayed);
    const k = kd(l.kills, l.deaths);
    // ">=" on ties: iterating oldest → newest, the later match wins the tie.
    if (a > bestAcs || (a === bestAcs && k >= bestKd)) {
      s.best = l;
      bestAcs = a;
      bestKd = k;
    }
  }

  s.acs = acs(score, rounds);
  s.kd = kd(kills, deaths);
  return s;
}

/** The gentle break note: only in a session still going on, after TILT_STREAK losses in a row. */
export function shouldSuggestBreak(session: Pick<CurrentSession<unknown>, "ongoing">, summary: Pick<SessionSummary<unknown>, "lossStreak">): boolean {
  return session.ongoing && summary.lossStreak >= TILT_STREAK;
}
