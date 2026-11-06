import { describe, expect, it } from "vitest";

import type { DashboardLine } from "./breakdown";
import { INSIGHT_MIN_SEGMENT, INSIGHT_MIN_TOTAL, buildInsights, dayPart, welch } from "./insights";

// 2026-11-05 is a Thursday. 23:00 UTC = 20:00 in São Paulo (UTC−3, no DST).
const base = new Date("2026-11-05T23:00:00Z");

let seq = 0;
function line(overrides: Partial<DashboardLine> = {}): DashboardLine {
  seq++;
  return {
    matchId: `m${seq}`,
    startedAt: new Date(base.getTime() - seq * 86_400_000),
    queueId: "competitive",
    mode: "Competitive",
    mapId: null,
    mapName: "Bind",
    agentId: null,
    agentName: "Sage",
    team: "Blue",
    redScore: 7,
    blueScore: 13,
    roundsPlayed: 20,
    winningTeam: "Blue",
    won: seq % 2 === 0,
    kills: 15,
    deaths: 15,
    assists: 5,
    score: 4000 + (seq % 3) * 200, // ACS 200–220, a little spread
    damageDealt: 2800,
    headshots: 18 + (seq % 3),
    bodyshots: 60,
    legshots: 4,
    ...overrides,
  };
}

const many = (count: number, overrides: Partial<DashboardLine> = {}) => Array.from({ length: count }, () => line(overrides));

describe("dayPart", () => {
  it("uses São Paulo time, not the server's", () => {
    expect(dayPart(new Date("2026-11-05T23:00:00Z"))).toBe("noite"); // 20:00
    expect(dayPart(new Date("2026-11-06T02:30:00Z"))).toBe("noite"); // 23:30
    expect(dayPart(new Date("2026-11-06T04:00:00Z"))).toBe("madrugada"); // 01:00
    expect(dayPart(new Date("2026-11-06T12:00:00Z"))).toBe("manha"); // 09:00
    expect(dayPart(new Date("2026-11-06T18:00:00Z"))).toBe("tarde"); // 15:00
  });
});

describe("welch", () => {
  it("is near zero for the same distribution and large for a clear gap", () => {
    expect(Math.abs(welch([1, 2, 3, 4], [1, 2, 3, 4]))).toBeLessThan(0.01);
    expect(welch([10, 11, 10, 11, 10], [1, 2, 1, 2, 1])).toBeGreaterThan(5);
    expect(welch([1, 1], [10, 10])).toBeLessThan(0);
  });

  it("returns 0 when a side is empty", () => {
    expect(welch([], [1])).toBe(0);
  });
});

describe("buildInsights", () => {
  it("says nothing below the minimum number of matches", () => {
    const lines = many(INSIGHT_MIN_TOTAL - 1, { mapName: "Ascent", headshots: 60 });
    expect(buildInsights(lines, "competitive")).toEqual({ status: "too-few", have: INSIGHT_MIN_TOTAL - 1, need: INSIGHT_MIN_TOTAL });
  });

  it("finds a map where HS% is clearly above the average", () => {
    const lines = [...many(6, { mapName: "Ascent", headshots: 40 }), ...many(14)];
    const result = buildInsights(lines, "competitive");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const hs = result.insights.find((i) => i.kind === "map-hs");
    expect(hs).toBeDefined();
    expect(hs!.tone).toBe("up");
    expect(hs!.subject).toBe("Ascent");
    expect(hs!.sentence).toMatch(/^Seu HS% em Ascent tende a ficar \d+ p\.p\. acima da sua média/);
    expect(hs!.sample).toBe("6 partidas de 20");
  });

  it("ignores a segment below the per-segment minimum, however big the gap", () => {
    const lines = [...many(INSIGHT_MIN_SEGMENT - 1, { mapName: "Ascent", headshots: 60 }), ...many(16)];
    const result = buildInsights(lines, "competitive");
    if (result.status === "ok") expect(result.insights.some((i) => i.subject === "Ascent")).toBe(false);
  });

  it("ignores a small gap even with plenty of matches", () => {
    // HS 19–21 % everywhere: no map stands out by 3 p.p.
    const lines = [...many(10, { mapName: "Ascent", headshots: 20 }), ...many(10, { mapName: "Bind", headshots: 19 })];
    expect(buildInsights(lines, "competitive").status).toBe("none");
  });

  it("compares a time of day with the other hours", () => {
    const night = new Date("2026-11-04T23:00:00Z"); // 20:00 SP
    const afternoon = new Date("2026-11-04T17:00:00Z"); // 14:00 SP
    const lines = [
      ...many(8, { startedAt: night, won: true }),
      ...many(2, { startedAt: night, won: false }),
      ...many(3, { startedAt: afternoon, won: true }),
      ...many(7, { startedAt: afternoon, won: false }),
    ];
    const result = buildInsights(lines, "competitive");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const time = result.insights.find((i) => i.kind === "time-winrate");
    expect(time).toBeDefined();
    // Strongest of the two sides first, then one per segment kind: "noite" up or "tarde" down.
    expect(time!.sentence).toMatch(/(vencer mais jogando à noite: 80%|à tarde, você tende a vencer menos: 30%)/);
  });

  it("flags a weaker agent with gentle wording", () => {
    const lines = [...many(6, { agentName: "Omen", score: 2400 }), ...many(14)];
    const result = buildInsights(lines, "competitive");
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    const agent = result.insights.find((i) => i.kind === "agent-acs" && i.subject === "Omen");
    expect(agent?.tone).toBe("down");
    expect(agent?.sentence).toMatch(/^Com Omen, seu ACS costuma ficar abaixo: 120, contra \d+ na sua média\.$/);
  });

  it("keeps at most one insight per segment and respects the max", () => {
    const lines = [
      ...many(6, { mapName: "Ascent", headshots: 40, won: true, agentName: "Jett", score: 6000 }),
      ...many(6, { mapName: "Lotus", headshots: 5, won: false }),
      ...many(12),
    ];
    const result = buildInsights(lines, "competitive", 2);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.insights).toHaveLength(2);
    const mapIds = result.insights.filter((i) => i.kind.startsWith("map")).map((i) => i.subject);
    expect(new Set(mapIds).size).toBe(mapIds.length);
  });

  it("never uses certainty words", () => {
    const lines = [...many(6, { mapName: "Ascent", headshots: 40, won: true }), ...many(14, { won: false })];
    const result = buildInsights(lines, "competitive");
    if (result.status !== "ok") throw new Error("expected insights");
    for (const i of result.insights) expect(i.sentence).toMatch(/tende|costuma|têm sido/);
  });
});
