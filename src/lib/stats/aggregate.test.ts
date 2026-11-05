import { describe, expect, it } from "vitest";

import { ALL_MODES, filterByMode, matchResult, summarize, type PlayerMatchLine } from "./aggregate";

function line(overrides: Partial<PlayerMatchLine> = {}): PlayerMatchLine {
  return {
    queueId: "competitive",
    roundsPlayed: 20,
    winningTeam: "Blue",
    won: true,
    kills: 20,
    deaths: 10,
    assists: 5,
    score: 5000,
    damageDealt: 3000,
    headshots: 10,
    bodyshots: 30,
    legshots: 0,
    ...overrides,
  };
}

describe("matchResult", () => {
  it("separates win, loss and draw", () => {
    expect(matchResult({ won: true, winningTeam: "Blue" })).toBe("win");
    expect(matchResult({ won: false, winningTeam: "Red" })).toBe("loss");
    expect(matchResult({ won: false, winningTeam: null })).toBe("draw");
  });
});

describe("summarize", () => {
  it("weights by volume across matches", () => {
    const s = summarize([line(), line({ roundsPlayed: 26, score: 5200, kills: 10, deaths: 20, damageDealt: 2200 })]);
    expect(s.matches).toBe(2);
    expect(s.acs).toBeCloseTo(10200 / 46, 5);
    expect(s.adr).toBeCloseTo(5200 / 46, 5);
    expect(s.kd).toBe(1);
  });

  it("zero deaths: K/D and KDA divide by 1", () => {
    const s = summarize([line({ kills: 7, deaths: 0, assists: 3 })]);
    expect(s.kd).toBe(7);
    expect(s.kda).toBe(10);
  });

  it("zero rounds: ACS and ADR are 0, not NaN/Infinity", () => {
    const s = summarize([line({ roundsPlayed: 0, score: 0, damageDealt: 0 })]);
    expect(s.acs).toBe(0);
    expect(s.adr).toBe(0);
  });

  it("zero shots: HS% is 0", () => {
    expect(summarize([line({ headshots: 0, bodyshots: 0, legshots: 0 })]).hsRate).toBe(0);
  });

  it("draws count as non-wins and are reported apart", () => {
    const s = summarize([
      line(),
      line({ won: false, winningTeam: "Red" }),
      line({ won: false, winningTeam: null }),
      line({ won: false, winningTeam: null }),
    ]);
    expect(s.winRate).toEqual({ rate: 0.25, wins: 1, losses: 1, draws: 2 });
  });

  it("defaults to competitive and never mixes modes silently", () => {
    const lines = [
      line({ kills: 30, deaths: 10 }),
      line({ queueId: "unrated", kills: 5, deaths: 20, won: false, winningTeam: "Red" }),
      line({ queueId: "deathmatch", kills: 40, deaths: 30, won: false, winningTeam: null }),
    ];

    const competitive = summarize(lines);
    expect(competitive.mode).toBe("competitive");
    expect(competitive.matches).toBe(1);
    expect(competitive.kd).toBe(3);

    const unrated = summarize(lines, { mode: "unrated" });
    expect(unrated).toMatchObject({ mode: "unrated", matches: 1, kd: 0.25 });

    const all = summarize(lines, { mode: ALL_MODES });
    expect(all).toMatchObject({ mode: "all", matches: 3, kills: 75, deaths: 60 });
  });

  it("an empty selection yields zeros", () => {
    const s = summarize([line({ queueId: "unrated" })]);
    expect(s).toMatchObject({ matches: 0, acs: 0, kd: 0, kda: 0, hsRate: 0, adr: 0 });
    expect(s.winRate.rate).toBe(0);
  });
});

describe("filterByMode", () => {
  it("keeps only the requested queue", () => {
    const lines = [line(), line({ queueId: "swiftplay" })];
    expect(filterByMode(lines)).toHaveLength(1);
    expect(filterByMode(lines, "swiftplay")).toHaveLength(1);
    expect(filterByMode(lines, ALL_MODES)).toHaveLength(2);
  });
});
