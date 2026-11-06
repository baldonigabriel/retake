import { describe, expect, it } from "vitest";

import { summarize } from "@/lib/stats/aggregate";

import { formatMetric, metricDelta, metricNumber, recordLine } from "./display";

describe("formatMetric", () => {
  it("formats each metric in pt-BR", () => {
    expect(formatMetric("acs", 245.6)).toBe("246");
    expect(formatMetric("kd", 1.234)).toBe("1,23");
    expect(formatMetric("winrate", 0.666)).toBe("67%");
    expect(formatMetric("matches", 12)).toBe("12");
  });

  it("gives the animated number the same value, decimals and unit as the text", () => {
    expect(metricNumber("acs", 245.6)).toEqual({ value: 246, digits: 0 });
    expect(metricNumber("kd", 1.234)).toEqual({ value: 1.234, digits: 2 });
    expect(metricNumber("winrate", 0.666)).toMatchObject({ digits: 0, suffix: "%" });
    expect(metricNumber("winrate", 0.666).value).toBeCloseTo(66.6);
  });
});

describe("metricDelta", () => {
  it("is null without a previous week", () => {
    expect(metricDelta("acs", 250, null).delta).toBeNull();
  });

  it("uses percentage points for win rate and whole ACS points", () => {
    expect(metricDelta("winrate", 0.6, 0.5)).toMatchObject({ suffix: " p.p.", digits: 0 });
    expect(metricDelta("winrate", 0.6, 0.5).delta).toBeCloseTo(10);
    expect(metricDelta("acs", 250.4, 240.6).delta).toBe(9);
    expect(metricDelta("kd", 1.5, 1.25)).toMatchObject({ delta: 0.25, digits: 2 });
  });
});

describe("recordLine", () => {
  const base = { queueId: "competitive", roundsPlayed: 20, kills: 1, deaths: 1, assists: 0, score: 1, damageDealt: 1, headshots: 0, bodyshots: 1, legshots: 0 };
  it("shows matches and the record, draws only when present", () => {
    const s = summarize([
      { ...base, won: true, winningTeam: "Blue" },
      { ...base, won: false, winningTeam: "Blue" },
    ]);
    expect(recordLine(s)).toBe("2 partidas · 1V 1D");
    const withDraw = summarize([{ ...base, won: false, winningTeam: null }]);
    expect(recordLine(withDraw)).toBe("1 partida · 0V 0D 1E");
  });
});
