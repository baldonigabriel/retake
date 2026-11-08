import { describe, expect, it } from "vitest";

import {
  SESSION_GAP_MS,
  TILT_STREAK,
  currentSession,
  matchEnd,
  shouldSuggestBreak,
  splitSessions,
  summarizeSession,
  type SessionMatchLine,
} from "./session";

const MIN = 60_000;
const HOUR = 60 * MIN;
// 2026-11-07 20:00 in São Paulo (UTC−3).
const evening = Date.parse("2026-11-07T23:00:00Z");

let seq = 0;
function match(startOffsetMs: number, overrides: Partial<SessionMatchLine> = {}): SessionMatchLine {
  seq++;
  return {
    matchId: `m${seq}`,
    startedAt: new Date(evening + startOffsetMs),
    gameLengthMs: 35 * MIN,
    queueId: "competitive",
    roundsPlayed: 20,
    winningTeam: "Blue",
    won: true,
    kills: 20,
    deaths: 10,
    assists: 5,
    score: 4000,
    damageDealt: 3000,
    headshots: 10,
    bodyshots: 30,
    legshots: 0,
    rrChange: 20,
    ...overrides,
  };
}
const loss = (offset: number, o: Partial<SessionMatchLine> = {}) =>
  match(offset, { won: false, winningTeam: "Red", rrChange: -18, score: 3000, ...o });

describe("matchEnd", () => {
  it("adds the duration, or uses the start when it's unknown", () => {
    const m = match(0);
    expect(matchEnd(m).getTime()).toBe(evening + 35 * MIN);
    expect(matchEnd({ ...m, gameLengthMs: null }).getTime()).toBe(evening);
    expect(matchEnd({ ...m, gameLengthMs: -5 }).getTime()).toBe(evening);
  });
});

describe("splitSessions", () => {
  it("keeps matches within 2 hours (end → next start) together", () => {
    const a = match(0); // ends 00:35
    const b = match(35 * MIN + 2 * HOUR); // starts exactly 2h after a ends: same session
    const c = match(35 * MIN + 2 * HOUR + 35 * MIN + 2 * HOUR + 1); // 1ms over the gap: new session
    const sessions = splitSessions([c, a, b]);
    expect(sessions.map((s) => s.map((l) => l.matchId))).toEqual([[c.matchId], [a.matchId, b.matchId]]);
  });

  it("measures the gap from the end, not the start, of the previous match", () => {
    const long = match(0, { gameLengthMs: 90 * MIN });
    const next = match(90 * MIN + 110 * MIN); // 1h50 after it ended, 3h20 after it started
    expect(splitSessions([long, next])).toHaveLength(1);
  });

  it("doesn't split when a match overlaps a longer one before it", () => {
    const long = match(0, { gameLengthMs: 4 * HOUR });
    const overlapping = match(30 * MIN, { gameLengthMs: 10 * MIN }); // ends way before `long`
    const after = match(4 * HOUR + HOUR); // 1h after `long` ended, 4h20 after `overlapping` ended
    expect(splitSessions([long, overlapping, after])).toHaveLength(1);
  });

  it("treats an unknown duration as zero", () => {
    const a = match(0, { gameLengthMs: null });
    expect(splitSessions([a, match(2 * HOUR)])).toHaveLength(1);
    expect(splitSessions([a, match(2 * HOUR + 1)])).toHaveLength(2);
  });

  it("returns nothing for no matches and one session for one match", () => {
    expect(splitSessions([])).toEqual([]);
    expect(splitSessions([match(0)])).toHaveLength(1);
  });

  it("accepts a custom gap", () => {
    expect(splitSessions([match(0), match(35 * MIN + 31 * MIN)], 30 * MIN)).toHaveLength(2);
  });

  it("orders matches with the same start by id, so the result is stable", () => {
    const x = match(0, { matchId: "b" });
    const y = match(0, { matchId: "a" });
    expect(splitSessions([x, y])[0]!.map((l) => l.matchId)).toEqual(["a", "b"]);
  });
});

describe("currentSession", () => {
  it("is ongoing while the last match ended up to 2 hours ago", () => {
    const lines = [match(0), match(40 * MIN)]; // last ends at 01:15 after `evening`
    const end = evening + 75 * MIN;
    const s = currentSession(lines, new Date(end + SESSION_GAP_MS));
    expect(s?.ongoing).toBe(true);
    expect(s?.lines.map((l) => l.matchId)).toEqual(lines.map((l) => l.matchId));
    expect(s?.startedAt.getTime()).toBe(evening);
    expect(s?.endedAt.getTime()).toBe(end);
    expect(currentSession(lines, new Date(end + SESSION_GAP_MS + 1))?.ongoing).toBe(false);
  });

  it("still shows a finished session that ended today (São Paulo), but not yesterday's", () => {
    // Played 09:00–09:35 in São Paulo; now is 21:00 the same day.
    const morning = Date.parse("2026-11-07T12:00:00Z");
    const lines = [match(morning - evening)];
    expect(currentSession(lines, new Date("2026-11-08T00:00:00Z"))).toMatchObject({ ongoing: false }); // 21:00 SP
    expect(currentSession(lines, new Date("2026-11-08T03:30:00Z"))).toBeNull(); // 00:30 SP, next day
  });

  it("counts a session that crossed midnight while it's still going on", () => {
    const lateNight = Date.parse("2026-11-08T02:30:00Z"); // 23:30 SP
    const lines = [match(lateNight - evening)];
    expect(currentSession(lines, new Date("2026-11-08T04:00:00Z"))?.ongoing).toBe(true); // 01:00 SP
  });

  it("only returns the latest session", () => {
    const old = match(-10 * HOUR);
    const recent = match(0);
    expect(currentSession([old, recent], new Date(evening + HOUR))?.lines.map((l) => l.matchId)).toEqual([recent.matchId]);
  });

  it("treats a match in the future (clock skew) as ongoing", () => {
    expect(currentSession([match(HOUR)], new Date(evening))?.ongoing).toBe(true);
  });

  it("returns null without matches", () => {
    expect(currentSession([], new Date(evening))).toBeNull();
  });
});

describe("summarizeSession", () => {
  it("adds up results, RR, ACS and K/D by volume", () => {
    const s = summarizeSession([match(0), loss(HOUR), match(2 * HOUR, { rrChange: 22 })]);
    expect(s).toMatchObject({ matches: 3, wins: 2, losses: 1, draws: 0, rr: 20 - 18 + 22, competitive: 3, rrMissing: 0 });
    expect(s.acs).toBeCloseTo((4000 + 3000 + 4000) / 60);
    expect(s.kd).toBeCloseTo(60 / 30);
    expect(s.modes).toEqual(["competitive"]);
  });

  it("sums only known RR and counts the competitive matches still without it", () => {
    const s = summarizeSession([match(0), match(HOUR, { rrChange: null }), match(2 * HOUR, { queueId: "unrated", rrChange: null })]);
    expect(s.rr).toBe(20);
    expect(s.competitive).toBe(2);
    expect(s.rrMissing).toBe(1);
  });

  it("reports every mode played, in play order", () => {
    const s = summarizeSession([match(2 * HOUR), match(0, { queueId: "unrated", rrChange: null })]);
    expect(s.modes).toEqual(["unrated", "competitive"]);
    expect(s.competitive).toBe(1);
  });

  it("picks the highest ACS as the best match; ties go to K/D, then the later match", () => {
    const top = match(0, { score: 6000 });
    expect(summarizeSession([match(HOUR), top, loss(2 * HOUR)]).best?.matchId).toBe(top.matchId);

    const betterKd = match(0, { kills: 30 });
    expect(summarizeSession([betterKd, match(HOUR)]).best?.matchId).toBe(betterKd.matchId);

    const first = match(0);
    const second = match(HOUR);
    expect(summarizeSession([second, first]).best?.matchId).toBe(second.matchId);
  });

  it("counts the losses in a row at the end; a win or a draw breaks it", () => {
    expect(summarizeSession([loss(0), match(HOUR), loss(2 * HOUR), loss(3 * HOUR)]).lossStreak).toBe(2);
    expect(summarizeSession([loss(0), loss(HOUR), loss(2 * HOUR)]).lossStreak).toBe(3);
    expect(summarizeSession([loss(0), loss(HOUR), match(2 * HOUR, { won: false, winningTeam: null })]).lossStreak).toBe(0);
    expect(summarizeSession([loss(2 * HOUR), match(HOUR), loss(0)]).lossStreak).toBe(1); // input order doesn't matter
  });

  it("is all zeros for an empty session", () => {
    expect(summarizeSession([])).toMatchObject({ matches: 0, rr: 0, acs: 0, kd: 0, best: null, lossStreak: 0, modes: [] });
  });

  it("handles matches without rounds", () => {
    const s = summarizeSession([match(0, { roundsPlayed: 0, score: 0 })]);
    expect(s.acs).toBe(0);
    expect(s.best).not.toBeNull();
  });
});

describe("shouldSuggestBreak", () => {
  it(`needs ${TILT_STREAK} losses in a row in a session still going on`, () => {
    expect(shouldSuggestBreak({ ongoing: true }, { lossStreak: TILT_STREAK })).toBe(true);
    expect(shouldSuggestBreak({ ongoing: true }, { lossStreak: TILT_STREAK + 2 })).toBe(true);
    expect(shouldSuggestBreak({ ongoing: true }, { lossStreak: TILT_STREAK - 1 })).toBe(false);
    expect(shouldSuggestBreak({ ongoing: false }, { lossStreak: 5 })).toBe(false);
  });
});
