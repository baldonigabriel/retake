import { describe, expect, it } from "vitest";

import { ALL_MODES } from "./aggregate";
import {
  byAgent,
  byMap,
  compareRecent,
  filterByPeriod,
  modeOptions,
  parseMode,
  parsePeriod,
  playerScore,
  trendSeries,
  type DashboardLine,
} from "./breakdown";

const now = new Date("2026-11-05T20:00:00Z");

function line(i: number, overrides: Partial<DashboardLine> = {}): DashboardLine {
  return {
    matchId: `m${i}`,
    startedAt: new Date(now.getTime() - i * 86_400_000),
    queueId: "competitive",
    mode: "Competitive",
    mapId: null,
    mapName: "Ascent",
    agentId: null,
    agentName: "Jett",
    team: "Blue",
    redScore: 7,
    blueScore: 13,
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

describe("modeOptions", () => {
  it("always offers competitive first, even with no competitive matches", () => {
    expect(modeOptions([line(0, { queueId: "unrated" })]).map((o) => o.value)).toEqual(["competitive", "unrated"]);
  });

  it("orders other modes by matches and only adds 'all' when there is something to mix", () => {
    const lines = [line(0), line(1, { queueId: "swiftplay" }), line(2, { queueId: "unrated" }), line(3, { queueId: "unrated" })];
    expect(modeOptions(lines).map((o) => o.value)).toEqual(["competitive", "unrated", "swiftplay", ALL_MODES]);
    expect(modeOptions([line(0)]).map((o) => o.value)).toEqual(["competitive"]);
  });

  it("parseMode rejects modes the player doesn't have", () => {
    const options = modeOptions([line(0)]);
    expect(parseMode("unrated", options)).toBe("competitive");
    expect(parseMode(undefined, options)).toBe("competitive");
  });
});

describe("filterByPeriod", () => {
  it("keeps matches inside the window", () => {
    const lines = [line(0), line(29), line(31), line(100)];
    expect(filterByPeriod(lines, "30d", now).map((l) => l.matchId)).toEqual(["m0", "m29"]);
    expect(filterByPeriod(lines, "90d", now)).toHaveLength(3);
    expect(filterByPeriod(lines, "all", now)).toHaveLength(4);
  });

  it("parsePeriod falls back to all", () => {
    expect(parsePeriod("7d")).toBe("all");
    expect(parsePeriod("30d")).toBe("30d");
  });
});

describe("compareRecent", () => {
  it("compares the newest N matches with the whole selection", () => {
    const lines = [line(0, { score: 6000 }), line(1, { score: 6000 }), line(2, { score: 2000 }), line(3, { score: 2000 })];
    const cmp = compareRecent(lines, "competitive", 2);
    expect(cmp.recent.acs).toBe(300);
    expect(cmp.overall.acs).toBe(200);
    expect(cmp.comparable).toBe(true);
  });

  it("is not comparable when everything fits in the window", () => {
    expect(compareRecent([line(0)], "competitive").comparable).toBe(false);
  });

  it("never mixes modes", () => {
    const cmp = compareRecent([line(0), line(1, { queueId: "unrated", score: 0 })], "competitive");
    expect(cmp.overall.matches).toBe(1);
    expect(cmp.overall.acs).toBe(250);
  });
});

describe("trendSeries", () => {
  it("returns the window oldest → newest with per-match values", () => {
    const series = trendSeries([line(0, { score: 6000 }), line(1, { score: 2000 })]);
    expect(series.map((p) => p.matchId)).toEqual(["m1", "m0"]);
    expect(series[1]).toMatchObject({ match: 2, acs: 300, kd: 2, hs: 25, adr: 150 });
  });
});

describe("byAgent / byMap", () => {
  it("groups by agent and map, most played first", () => {
    const lines = [line(0), line(1, { agentName: "Sage", mapName: "Bind" }), line(2, { agentName: "Sage", won: false, winningTeam: "Red" })];
    const agents = byAgent(lines, "competitive");
    expect(agents.map((a) => [a.name, a.summary.matches])).toEqual([
      ["Sage", 2],
      ["Jett", 1],
    ]);
    expect(agents[0]!.summary.winRate.rate).toBe(0.5);
    expect(byMap(lines, "competitive").map((m) => m.name)).toEqual(["Ascent", "Bind"]);
  });
});

describe("playerScore", () => {
  it("puts the player's team first", () => {
    expect(playerScore({ team: "Red", redScore: 9, blueScore: 13 })).toEqual({ own: 9, enemy: 13 });
    expect(playerScore({ team: "Blue", redScore: 9, blueScore: 13 })).toEqual({ own: 13, enemy: 9 });
  });
});
