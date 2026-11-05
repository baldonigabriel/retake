import { describe, expect, it } from "vitest";

import { acs, adr, hsRate, kd, kda, winRate } from "./metrics";

describe("metrics", () => {
  it("ACS = score / rounds", () => {
    expect(acs(6118, 22)).toBeCloseTo(278.09, 2);
    expect(acs(100, 0)).toBe(0);
  });

  it("K/D divides by at least 1 death", () => {
    expect(kd(24, 14)).toBeCloseTo(1.714, 3);
    expect(kd(10, 0)).toBe(10);
  });

  it("KDA counts assists and guards zero deaths", () => {
    expect(kda(24, 14, 5)).toBeCloseTo(2.071, 3);
    expect(kda(3, 0, 2)).toBe(5);
  });

  it("HS% uses all hits", () => {
    expect(hsRate(31, 72, 6)).toBeCloseTo(31 / 109, 5);
    expect(hsRate(0, 0, 0)).toBe(0);
  });

  it("ADR = damage / rounds", () => {
    expect(adr(3830, 22)).toBeCloseTo(174.09, 2);
    expect(adr(500, 0)).toBe(0);
  });

  it("win rate counts draws as non-wins and reports them apart", () => {
    expect(winRate(["win", "loss", "draw", "win"])).toEqual({
      rate: 0.5,
      wins: 2,
      losses: 1,
      draws: 1,
    });
    expect(winRate([]).rate).toBe(0);
  });
});
