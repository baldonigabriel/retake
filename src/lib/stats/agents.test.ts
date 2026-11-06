import { describe, expect, it } from "vitest";

import {
  BEST_MAP_MIN_MATCHES,
  agentSlug,
  agentStats,
  columnBests,
  bestMap,
  linesForAgent,
  mapStats,
  performance,
  toHours,
  type AgentLine,
} from "./agents";

let seq = 0;
function line(overrides: Partial<AgentLine> = {}): AgentLine {
  return {
    matchId: `m${seq++}`,
    queueId: "competitive",
    agentId: "raze-id",
    agentName: "Raze",
    mapId: "split-id",
    mapName: "Split",
    roundsPlayed: 20,
    winningTeam: "Blue",
    won: true,
    kills: 20,
    deaths: 10,
    assists: 5,
    score: 5000,
    damageDealt: 3000,
    damageReceived: 2000,
    headshots: 10,
    bodyshots: 30,
    legshots: 0,
    gameLengthMs: 1_800_000,
    ...overrides,
  };
}
const loss = (o: Partial<AgentLine> = {}) => line({ won: false, winningTeam: "Red", ...o });
const draw = (o: Partial<AgentLine> = {}) => line({ won: false, winningTeam: null, ...o });

describe("performance", () => {
  it("counts wins, losses and draws apart; draws are non-wins in the rate", () => {
    const p = performance([line(), loss(), draw(), line()]);
    expect(p).toMatchObject({ matches: 4, wins: 2, losses: 1, draws: 1, winRate: 0.5 });
  });

  it("weights by volume, not by averaging per-match values", () => {
    // 13 rounds at ACS 400 + 26 rounds at ACS 200 → 10400 / 39, not (400 + 200) / 2
    const p = performance([line({ roundsPlayed: 13, score: 5200 }), line({ roundsPlayed: 26, score: 5200 })]);
    expect(p.acs).toBeCloseTo(10400 / 39, 6);
  });

  it("computes K/D, ADR, HS% and DDΔ from totals", () => {
    const p = performance([
      line({ kills: 10, deaths: 5, damageDealt: 2000, damageReceived: 1000, headshots: 5, bodyshots: 15 }),
      line({ kills: 20, deaths: 15, damageDealt: 1000, damageReceived: 3000, headshots: 15, bodyshots: 25 }),
    ]);
    expect(p.kd).toBeCloseTo(30 / 20, 6);
    expect(p.adr).toBeCloseTo(3000 / 40, 6);
    expect(p.hsRate).toBeCloseTo(20 / 60, 6);
    expect(p.ddDelta).toBeCloseTo((3000 - 4000) / 40, 6); // negative: took more than dealt
  });

  it("sums only known durations and says how many were timed", () => {
    const p = performance([line({ gameLengthMs: 1_000_000 }), line({ gameLengthMs: null }), line({ gameLengthMs: 2_600_000 })]);
    expect(p.playMs).toBe(3_600_000);
    expect(p.timedMatches).toBe(2);
    expect(toHours(p.playMs)).toBe(1);
  });

  it("returns zeros, not NaN, for no lines and for zero-round matches", () => {
    expect(performance([])).toMatchObject({ matches: 0, winRate: 0, acs: 0, kd: 0, adr: 0, hsRate: 0, ddDelta: 0, playMs: 0 });
    const p = performance([line({ roundsPlayed: 0, deaths: 0, kills: 3, headshots: 0, bodyshots: 0 })]);
    expect(p).toMatchObject({ acs: 0, adr: 0, ddDelta: 0, hsRate: 0, kd: 3 });
  });
});

describe("bestMap", () => {
  it("needs the minimum number of matches on the map", () => {
    const maps = mapStats([
      line({ mapId: "bind", mapName: "Bind" }), // 1–0, 100% but only one match
      line(),
      line(),
      loss(), // Split 2–1
    ]);
    expect(bestMap(maps)?.mapName).toBe("Split");
    expect(bestMap(maps, 4)).toBeNull();
    expect(bestMap(maps, 1)?.mapName).toBe("Bind");
  });

  it("breaks win-rate ties by number of matches, then by name", () => {
    const on = (mapName: string) => ({ mapId: mapName.toLowerCase(), mapName });
    const record = (mapName: string, wins: number, losses: number) => [
      ...Array.from({ length: wins }, () => line(on(mapName))),
      ...Array.from({ length: losses }, () => loss(on(mapName))),
    ];
    const split = record("Split", 2, 2); // 50%, 4 matches
    const ascent = record("Ascent", 2, 2); // 50%, 4 matches
    const haven = record("Haven", 3, 3); // 50%, 6 matches
    expect(bestMap(mapStats([...split, ...ascent, ...haven]))?.mapName).toBe("Haven");
    expect(bestMap(mapStats([...split, ...ascent]))?.mapName).toBe("Ascent"); // same rate and count → alphabetical
  });

  it("treats draws as non-wins when ranking maps", () => {
    const lines = [line(), draw(), draw(), ...[line(), line(), loss()].map((l) => ({ ...l, mapId: "b", mapName: "Bind" }))];
    expect(bestMap(mapStats(lines))?.mapName).toBe("Bind");
  });

  it("defaults to the documented minimum", () => {
    expect(BEST_MAP_MIN_MATCHES).toBe(3);
    expect(bestMap([])).toBeNull();
  });
});

describe("agentStats", () => {
  const lines = [
    line(),
    line(),
    loss(),
    line({ mapId: "bind", mapName: "Bind" }),
    line({ agentId: "jett-id", agentName: "Jett", gameLengthMs: 2_400_000 }),
    loss({ agentId: "jett-id", agentName: "Jett" }),
    line({ agentId: "sage-id", agentName: "Sage", gameLengthMs: 2_400_000 }),
    loss({ agentId: "sage-id", agentName: "Sage", gameLengthMs: 2_400_000 }),
  ];

  it("orders by matches, then time played, then name", () => {
    expect(agentStats(lines).map((a) => a.agentName)).toEqual(["Raze", "Sage", "Jett"]);
  });

  it("aggregates each agent with its own best map", () => {
    const [raze] = agentStats(lines);
    expect(raze).toMatchObject({ matches: 4, wins: 3, losses: 1, draws: 0, winRate: 0.75, slug: "raze" });
    expect(raze!.bestMap?.mapName).toBe("Split");
    expect(raze!.bestMap?.winRate).toBeCloseTo(2 / 3, 6);
    expect(toHours(raze!.playMs)).toBe(2);
  });

  it("has no best map when no map reaches the minimum", () => {
    const jett = agentStats(lines).find((a) => a.agentName === "Jett")!;
    expect(jett.bestMap).toBeNull();
    expect(agentStats(lines, { bestMapMinMatches: 1 }).find((a) => a.agentName === "Jett")!.bestMap?.mapName).toBe("Split");
  });

  it("groups lines without an agent instead of dropping them", () => {
    const rows = agentStats([line({ agentId: null, agentName: null })]);
    expect(rows[0]).toMatchObject({ agentName: "Agente desconhecido", matches: 1, slug: null });
  });

  it("returns an empty list for no lines", () => {
    expect(agentStats([])).toEqual([]);
  });
});

describe("agentSlug / linesForAgent", () => {
  it("makes URL-safe, accent-free slugs", () => {
    expect(agentSlug("KAY/O")).toBe("kay-o");
    expect(agentSlug("Raze")).toBe("raze");
    expect(agentSlug("  Café  Noir ")).toBe("cafe-noir");
    expect(agentSlug(null)).toBe("desconhecido");
  });

  it("finds an agent's lines case-insensitively", () => {
    const lines = [line(), line({ agentName: "KAY/O" }), line({ agentName: null })];
    expect(linesForAgent(lines, "KAY-O")).toHaveLength(1);
    expect(linesForAgent(lines, "raze")).toHaveLength(1);
    expect(linesForAgent(lines, "desconhecido")).toHaveLength(0);
  });
});

describe("columnBests", () => {
  const many = (n: number, o: Partial<AgentLine>) => Array.from({ length: n }, () => line(o));
  const agents = agentStats([
    ...many(3, { agentId: "a", agentName: "Raze", kills: 30, score: 6000 }),
    ...many(3, { agentId: "b", agentName: "Sage", kills: 10, score: 6000, won: false, winningTeam: "Red" }),
    ...many(1, { agentId: "c", agentName: "Jett", kills: 90, score: 9000 }), // 1 match: never a best
  ]);

  it("picks the top value per column among agents with enough matches", () => {
    const bests = columnBests(agents);
    expect([...bests.kd]).toEqual(["a"]);
    expect([...bests.winRate]).toEqual(["a"]);
  });

  it("keeps every agent tied at the top", () => {
    expect([...columnBests(agents).acs].sort()).toEqual(["a", "b"]);
  });

  it("highlights nothing with fewer than two eligible agents", () => {
    const bests = columnBests(agents, 4);
    expect(Object.values(bests).every((s) => s.size === 0)).toBe(true);
  });
});
