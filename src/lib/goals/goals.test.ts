import { describe, expect, it } from "vitest";

import type { PlayerMatchLine } from "@/lib/stats/aggregate";

import { GOAL_MIN_MATCHES, evaluateGoal, goalInputSchema, goalLabel } from "./goals";

function line(over: Partial<PlayerMatchLine> = {}): PlayerMatchLine {
  return {
    queueId: "competitive",
    roundsPlayed: 20,
    winningTeam: "Blue",
    won: true,
    kills: 20,
    deaths: 10,
    assists: 5,
    score: 5000, // ACS 250
    damageDealt: 3000, // ADR 150
    headshots: 25,
    bodyshots: 70,
    legshots: 5, // HS 25%
    ...over,
  };
}
const many = (n: number, over: Partial<PlayerMatchLine> = {}) => Array.from({ length: n }, () => line(over));

describe("goalInputSchema", () => {
  it("accepts comma decimals and rounds to the metric's precision", () => {
    expect(goalInputSchema.parse({ metric: "kd", target: "1,234" })).toEqual({ metric: "kd", target: 1.23 });
    expect(goalInputSchema.parse({ metric: "hs", target: 25.4 })).toEqual({ metric: "hs", target: 25 });
  });

  it("rejects empty, non-numeric and out-of-range targets with a readable message", () => {
    const empty = goalInputSchema.safeParse({ metric: "hs", target: " " });
    expect(empty.success).toBe(false);
    expect(empty.error?.issues[0]?.message).toBe("Digite um número.");
    expect(goalInputSchema.safeParse({ metric: "hs", target: "abc" }).success).toBe(false);
    const high = goalInputSchema.safeParse({ metric: "hs", target: 95 });
    expect(high.error?.issues[0]?.message).toBe("Use um valor entre 1% e 80%.");
    expect(goalInputSchema.safeParse({ metric: "nope", target: 1 }).success).toBe(false);
  });
});

describe("goalLabel", () => {
  it("reads like a sentence", () => {
    expect(goalLabel("hs", 25)).toBe("HS% acima de 25%");
    expect(goalLabel("kd", 1.2)).toBe("K/D acima de 1,20");
    expect(goalLabel("winrate", 60)).toBe("Vencer 60% das partidas");
    expect(goalLabel("matches", 1)).toBe("Jogar 1 partida");
  });
});

describe("evaluateGoal", () => {
  it("waits for the first competitive match of the week", () => {
    const p = evaluateGoal({ metric: "hs", target: 25 }, [line({ queueId: "unrated" })]);
    expect(p).toMatchObject({ status: "not-started", value: null, ratio: 0, matches: 0 });
  });

  it("is provisional below the minimum number of matches", () => {
    const p = evaluateGoal({ metric: "hs", target: 20 }, many(GOAL_MIN_MATCHES - 1));
    expect(p.status).toBe("provisional");
    expect(p.note).toBe("25% em 2 partidas. Jogue mais 1 para valer.");
  });

  it("is reached when the shown value meets the target", () => {
    // 24,6% shows as 25%: it must not say "below 25%".
    const lines = many(3, { headshots: 246, bodyshots: 754, legshots: 0 });
    expect(evaluateGoal({ metric: "hs", target: 25 }, lines)).toMatchObject({ status: "reached", ratio: expect.closeTo(0.984, 2) });
  });

  it("says how far below the target, in the metric's unit", () => {
    expect(evaluateGoal({ metric: "hs", target: 30 }, many(4)).note).toBe("Faltam 5 p.p. (4 partidas na semana).");
    expect(evaluateGoal({ metric: "acs", target: 262 }, many(4)).note).toBe("Faltam 12 de ACS (4 partidas na semana).");
    expect(evaluateGoal({ metric: "kd", target: 2.15 }, many(4)).note).toBe("Faltam 0,15 de K/D (4 partidas na semana).");
  });

  it("counts matches for a volume goal, with no minimum", () => {
    expect(evaluateGoal({ metric: "matches", target: 10 }, many(4))).toMatchObject({ status: "below", value: 4, ratio: 0.4, note: "Faltam 6 partidas." });
    expect(evaluateGoal({ metric: "matches", target: 3 }, many(4))).toMatchObject({ status: "reached", ratio: 1 });
  });

  it("uses win rate in percent and draws as non-wins", () => {
    const lines = [...many(2), line({ won: false, winningTeam: null })];
    expect(evaluateGoal({ metric: "winrate", target: 70 }, lines)).toMatchObject({ status: "below", value: expect.closeTo(66.67, 1) });
  });
});
