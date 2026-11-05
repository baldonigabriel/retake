import { describe, expect, it } from "vitest";

import { tierIconUrl, tierLabel } from "./ranks";

describe("tierLabel", () => {
  it.each([
    [0, "Sem rank"],
    [3, "Ferro 1"],
    [11, "Prata 3"],
    [18, "Diamante 1"],
    [24, "Imortal 1"],
    [27, "Radiante"],
  ])("tier %i → %s", (tier, label) => {
    expect(tierLabel(tier)).toBe(label);
  });

  it("only builds icon URLs for real tiers", () => {
    expect(tierIconUrl(0)).toBeUndefined();
    expect(tierIconUrl(18)).toMatch(/\/18\/smallicon\.png$/);
  });
});
