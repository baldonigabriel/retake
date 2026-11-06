import { describe, expect, it } from "vitest";

import {
  HISTORY_MAX,
  dayKey,
  dayLabel,
  filterHistory,
  groupByDay,
  historyOptions,
  historySummary,
  parseHistoryFilter,
  parseShow,
  type HistoryLine,
} from "./history";

const now = new Date("2026-11-06T18:00:00Z"); // 15:00 in São Paulo

let seq = 0;
function line(at: string, overrides: Partial<HistoryLine> = {}): HistoryLine {
  return {
    matchId: `m${seq++}`,
    startedAt: new Date(at),
    queueId: "competitive",
    agentId: "raze",
    agentName: "Raze",
    mapId: "split",
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
    rrChange: 18,
    ...overrides,
  };
}

describe("dayKey / dayLabel", () => {
  it("uses the São Paulo calendar day, not UTC", () => {
    // 01:30 UTC on the 6th is still 22:30 on the 5th in São Paulo
    expect(dayKey(new Date("2026-11-06T01:30:00Z"))).toBe("2026-11-05");
    expect(dayKey(new Date("2026-11-06T03:30:00Z"))).toBe("2026-11-06");
  });

  it("says Hoje, Ontem, then the weekday and date (year only when different)", () => {
    expect(dayLabel("2026-11-06", now)).toBe("Hoje");
    expect(dayLabel("2026-11-05", now)).toBe("Ontem");
    expect(dayLabel("2026-11-04", now)).toBe("qua., 4 de nov");
    expect(dayLabel("2025-12-31", now)).toMatch(/31 de dez.* 2025/);
  });
});

describe("groupByDay", () => {
  it("groups newest-first items by day with wins, losses, draws and RR", () => {
    const days = groupByDay(
      [
        line("2026-11-06T17:00:00Z", { rrChange: 18 }),
        line("2026-11-06T16:00:00Z", { won: false, winningTeam: "Red", rrChange: -15 }),
        line("2026-11-06T02:00:00Z", { won: false, winningTeam: null, rrChange: 0 }), // 23:00 on the 5th
        line("2026-11-04T20:00:00Z", { queueId: "unrated", rrChange: null }),
      ],
      now,
    );
    expect(days.map((d) => [d.label, d.wins, d.losses, d.draws, d.rr, d.competitive, d.items.length])).toEqual([
      ["Hoje", 1, 1, 0, 3, 2, 2],
      ["Ontem", 0, 0, 1, 0, 1, 1],
      ["qua., 4 de nov", 1, 0, 0, 0, 0, 1],
    ]);
  });

  it("never shows a partial RR total: one competitive match without RR makes the day unknown", () => {
    const [day] = groupByDay([line("2026-11-06T17:00:00Z", { rrChange: 20 }), line("2026-11-06T16:00:00Z", { rrChange: null })], now);
    expect(day!.rr).toBeNull();
  });

  it("returns no days for no items", () => {
    expect(groupByDay([], now)).toEqual([]);
  });
});

describe("historySummary", () => {
  it("summarises the newest 20 with the 3 most played agents", () => {
    const lines = [
      ...Array.from({ length: 8 }, (_, i) => line(`2026-11-0${(i % 5) + 1}T12:00:00Z`)),
      ...Array.from({ length: 6 }, () => line("2026-11-01T12:00:00Z", { agentId: "jett", agentName: "Jett", won: false, winningTeam: "Red" })),
      ...Array.from({ length: 4 }, () => line("2026-11-01T12:00:00Z", { agentId: "sage", agentName: "Sage" })),
      ...Array.from({ length: 2 }, () => line("2026-11-01T12:00:00Z", { agentId: "omen", agentName: "Omen" })),
      ...Array.from({ length: 5 }, () => line("2026-10-01T12:00:00Z", { agentId: "omen", agentName: "Omen" })), // outside the window
    ];
    const { stats, topAgents } = historySummary(lines);
    expect(stats).toMatchObject({ matches: 20, wins: 14, losses: 6 });
    expect(topAgents.map((a) => [a.agentName, a.matches, a.wins])).toEqual([
      ["Raze", 8, 8],
      ["Jett", 6, 0],
      ["Sage", 4, 4],
    ]);
  });

  it("works with fewer lines than the window and with none", () => {
    expect(historySummary([line("2026-11-06T12:00:00Z")]).stats.matches).toBe(1);
    expect(historySummary([])).toEqual({ stats: expect.objectContaining({ matches: 0 }), topAgents: [] });
  });
});

describe("parseShow", () => {
  it("rounds to whole pages within bounds", () => {
    expect(parseShow(undefined)).toBe(20);
    expect(parseShow("abc")).toBe(20);
    expect(parseShow("-40")).toBe(20);
    expect(parseShow("40")).toBe(40);
    expect(parseShow("41")).toBe(60);
    expect(parseShow("99999")).toBe(HISTORY_MAX);
  });
});

describe("history filters", () => {
  const lines = [
    line("2026-11-06T12:00:00Z"),
    line("2026-11-05T12:00:00Z", { agentName: "KAY/O", mapName: "Bind" }),
    line("2026-11-04T12:00:00Z", { agentName: "KAY/O", mapName: "Split" }),
    line("2026-11-03T12:00:00Z", { agentName: null, mapName: null }),
  ];

  it("offers agents and maps by most played, as slugs", () => {
    expect(historyOptions(lines)).toEqual({
      agents: [
        { value: "kay-o", label: "KAY/O" },
        { value: "raze", label: "Raze" },
      ],
      maps: [
        { value: "split", label: "Split" },
        { value: "bind", label: "Bind" },
      ],
    });
  });

  it("filters by agent and map together and ignores unknown values", () => {
    const { agents, maps } = historyOptions(lines);
    expect(filterHistory(lines, { agent: "kay-o", map: "split" })).toHaveLength(1);
    expect(filterHistory(lines, { map: "split" })).toHaveLength(2);
    expect(filterHistory(lines, {})).toHaveLength(4);
    expect(parseHistoryFilter("jett", agents)).toBeUndefined();
    expect(parseHistoryFilter("bind", maps)).toBe("bind");
  });
});
