import { describe, expect, it } from "vitest";

import { uniqueBackfillTargets } from "./backfill-rounds";

describe("uniqueBackfillTargets", () => {
  it("keeps one API request per match even when two Retake users played it", () => {
    const startedAt = new Date("2026-11-01T12:00:00Z");
    expect(
      uniqueBackfillTargets([
        { matchId: "m1", region: "br", startedAt },
        { matchId: "m1", region: "br", startedAt },
        { matchId: "m2", region: "br", startedAt },
      ]),
    ).toEqual([
      { matchId: "m1", region: "br", startedAt },
      { matchId: "m2", region: "br", startedAt },
    ]);
  });
});
