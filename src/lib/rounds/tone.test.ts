import { describe, expect, it } from "vitest";

import type { ClutchByX } from "./metrics";
import { clutchTone, clutchTotalTone, economyTone, kastTone, openingTone, sideTone } from "./tone";

const rate = (successes: number, sample: number) => ({ successes, sample, value: sample > 0 ? successes / sample : null });
const clutch = (entries: Partial<Record<1 | 2 | 3 | 4 | 5, [number, number]>>): ClutchByX => {
  const out = {} as ClutchByX;
  for (const x of [1, 2, 3, 4, 5] as const) {
    const [wins, situations] = entries[x] ?? [0, 0];
    out[x] = { wins, situations, rate: situations > 0 ? wins / situations : null };
  }
  return out;
};

describe("round tones", () => {
  it("reads a side win rate against 50% once the sample is big enough", () => {
    expect(sideTone(rate(6, 10))).toBe("good");
    expect(sideTone(rate(4, 10))).toBe("bad");
    expect(sideTone(rate(5, 10))).toBe("neutral");
    expect(sideTone(rate(9, 9))).toBe("neutral");
  });

  it("compares first bloods with first deaths", () => {
    expect(openingTone(rate(67, 643), rate(48, 643))).toBe("good");
    expect(openingTone(rate(10, 100), rate(12, 100))).toBe("bad");
    expect(openingTone(rate(0, 0), rate(0, 0))).toBe("neutral");
  });

  it("keeps KAST between 65% and 70% neutral", () => {
    expect(kastTone(rate(74, 100))).toBe("good");
    expect(kastTone(rate(67, 100))).toBe("neutral");
    expect(kastTone(rate(60, 100))).toBe("bad");
  });

  it("judges each clutch spot against its own reference", () => {
    expect(clutchTone(3, clutch({ 3: [4, 16] })[3])).toBe("good");
    expect(clutchTone(4, clutch({ 4: [0, 19] })[4])).toBe("bad");
    expect(clutchTone(1, clutch({ 1: [2, 2] })[1])).toBe("neutral");
  });

  it("weights the total clutch reference by how often each spot happened", () => {
    // 15/64 = 23%; expected ≈ (9·.5 + 14·.25 + 16·.1 + 19·.04 + 6·.01) / 64 ≈ 16%
    expect(clutchTotalTone(clutch({ 1: [6, 9], 2: [5, 14], 3: [4, 16], 4: [0, 19], 5: [0, 6] }))).toBe("good");
    expect(clutchTotalTone(clutch({ 1: [0, 10] }))).toBe("bad");
  });

  it("reads eco rounds against an eco reference, not 50%", () => {
    expect(economyTone({ band: "eco", wins: 9, rounds: 68, winRate: 9 / 68, acs: 155, acsSample: 68 })).toBe("bad");
    expect(economyTone({ band: "eco", wins: 14, rounds: 68, winRate: 14 / 68, acs: 155, acsSample: 68 })).toBe("good");
    expect(economyTone({ band: "full", wins: 2, rounds: 3, winRate: 2 / 3, acs: 300, acsSample: 3 })).toBe("neutral");
  });
});
