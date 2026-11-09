import { describe, expect, it } from "vitest";

import type { GroupStats } from "./breakdown";
import { bestMaps, parseTab } from "./overview";

const map = (name: string, matches: number, wins: number): GroupStats => ({
  key: name,
  name,
  id: null,
  summary: {
    mode: "competitive",
    matches,
    rounds: matches * 20,
    kills: 0,
    deaths: 0,
    assists: 0,
    acs: 200,
    kd: 1,
    kda: 1,
    hsRate: 0.2,
    adr: 130,
    winRate: { rate: wins / matches, wins, losses: matches - wins, draws: 0 },
  },
});

describe("parseTab", () => {
  it("accepts known tabs and falls back to the overview", () => {
    expect(parseTab("agents")).toBe("agents");
    expect(parseTab(["combat", "maps"])).toBe("combat");
    expect(parseTab("nope")).toBe("overview");
    expect(parseTab(undefined)).toBe("overview");
  });

  it("opens the matches of a mate filter when no tab is given", () => {
    expect(parseTab(undefined, { withMate: true })).toBe("matches");
    expect(parseTab("duos", { withMate: true })).toBe("duos");
  });
});

describe("bestMaps", () => {
  it("ranks by win rate among maps with 3+ matches, ties to more matches", () => {
    const picked = bestMaps([map("Bind", 10, 6), map("Haven", 2, 2), map("Lotus", 5, 3), map("Abyss", 4, 3)]);
    expect(picked.map((m) => m.name)).toEqual(["Abyss", "Bind", "Lotus"]);
  });

  it("is empty when no map has enough matches", () => {
    expect(bestMaps([map("Haven", 2, 2)])).toEqual([]);
  });
});
