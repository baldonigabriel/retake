import { describe, expect, it } from "vitest";

import { ALL_SEASONS, filterBySeason, parseSeason, seasonFallbackLabel, seasonLabel, seasonOptions } from "./seasons";

const info = (title: string | null, displayName: string | null = null) => ({ title, displayName, startTime: null });

describe("seasonLabel", () => {
  it("shortens catalog titles", () => {
    expect(seasonLabel(info("V26 // ATO VI"))).toBe("V26 · Ato VI");
    expect(seasonLabel(info("EPISÓDIO 9 // ATO I"))).toBe("E9 · Ato I");
    expect(seasonLabel(info(null, "CONTESTAÇÃO"))).toBe("Contestação");
  });

  it("returns null without a usable name", () => {
    expect(seasonLabel(undefined)).toBeNull();
    expect(seasonLabel(info("  ", ""))).toBeNull();
  });
});

describe("seasonOptions", () => {
  const lines = [
    { seasonId: "B", startedAt: new Date("2026-11-05T12:00:00Z") },
    { seasonId: "A", startedAt: new Date("2026-09-02T12:00:00Z") },
    { seasonId: "B", startedAt: new Date("2026-10-20T12:00:00Z") },
    { seasonId: null, startedAt: new Date("2026-08-01T12:00:00Z") },
  ];
  const catalog = new Map([["b", info("V26 // ATO VI")]]);

  it("lists 'Todas' first, then seasons newest first, with fallback names", () => {
    expect(seasonOptions(lines, catalog)).toEqual([
      { value: ALL_SEASONS, label: "Todas", matches: 4 },
      { value: "B", label: "V26 · Ato VI", matches: 2 },
      { value: "A", label: seasonFallbackLabel(new Date("2026-09-02T12:00:00Z")), matches: 1 },
    ]);
    expect(seasonFallbackLabel(new Date("2026-09-02T12:00:00Z"))).toBe("Temporada de set. 2026");
  });

  it("parses only known seasons and filters by id", () => {
    const options = seasonOptions(lines, catalog);
    expect(parseSeason("B", options)).toBe("B");
    expect(parseSeason("Z", options)).toBe(ALL_SEASONS);
    expect(parseSeason(undefined, options)).toBe(ALL_SEASONS);
    expect(filterBySeason(lines, "B")).toHaveLength(2);
    expect(filterBySeason(lines, ALL_SEASONS)).toHaveLength(4);
  });
});
