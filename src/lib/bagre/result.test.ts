import { describe, expect, it } from "vitest";

import { decideBagre, sortTally, type TallyEntry } from "./result";

const entry = (id: string, votes: number, matches: number): TallyEntry => ({ nominationId: `n-${id}`, nomineeId: `u-${id}`, votes, matches });

describe("decideBagre", () => {
  it("is empty without nominations", () => {
    expect(decideBagre([])).toEqual({ outcome: "empty", tally: [] });
  });

  it("has no Bagre when nobody voted", () => {
    expect(decideBagre([entry("a", 0, 3), entry("b", 0, 1)]).outcome).toBe("no_votes");
  });

  it("picks the most voted", () => {
    const d = decideBagre([entry("a", 1, 3), entry("b", 3, 9), entry("c", 2, 1)]);
    expect(d).toMatchObject({ outcome: "winner", winner: { nomineeId: "u-b" }, byTieBreak: false });
  });

  it("breaks a tie on votes by fewer matches in the period", () => {
    const d = decideBagre([entry("a", 2, 5), entry("b", 2, 2), entry("c", 1, 0)]);
    expect(d).toMatchObject({ outcome: "winner", winner: { nomineeId: "u-b" }, byTieBreak: true });
  });

  it("declares a tie when votes and matches are equal", () => {
    const d = decideBagre([entry("a", 2, 3), entry("b", 2, 3), entry("c", 1, 1)]);
    expect(d.outcome).toBe("tie");
    if (d.outcome === "tie") expect(d.tied.map((e) => e.nomineeId).sort()).toEqual(["u-a", "u-b"]);
  });

  it("only ties among the leaders with the fewest matches", () => {
    const d = decideBagre([entry("a", 2, 1), entry("b", 2, 1), entry("c", 2, 4)]);
    expect(d.outcome).toBe("tie");
    if (d.outcome === "tie") expect(d.tied).toHaveLength(2);
  });

  it("a single nomination with one vote wins", () => {
    expect(decideBagre([entry("a", 1, 2)])).toMatchObject({ outcome: "winner", byTieBreak: false });
  });
});

describe("sortTally", () => {
  it("orders by votes, then fewer matches, then id", () => {
    expect(sortTally([entry("b", 1, 1), entry("a", 1, 1), entry("c", 2, 9), entry("d", 1, 0)]).map((e) => e.nomineeId)).toEqual([
      "u-c",
      "u-d",
      "u-a",
      "u-b",
    ]);
  });
});
