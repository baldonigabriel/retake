import { describe, expect, it } from "vitest";

import { rawMatch, ME_PUUID } from "@/lib/henrik/fixtures";
import { matchSchema } from "@/lib/henrik/schemas";
import { toMatchRow, toPlayerRows } from "@/lib/sync/map";

import { buildScoreboard } from "./scoreboard";

function stored(overrides: Parameters<typeof rawMatch>[0] = {}) {
  const match = matchSchema.parse(rawMatch(overrides));
  const row = { ...toMatchRow(match), createdAt: new Date() } as Parameters<typeof buildScoreboard>[0];
  const players = toPlayerRows(match) as Parameters<typeof buildScoreboard>[1];
  return { row, players };
}

describe("buildScoreboard", () => {
  it("puts the viewer's team first and marks only the viewer", () => {
    const { row, players } = stored({ blueRounds: 13, redRounds: 9 });
    const board = buildScoreboard(row, players, ME_PUUID);
    expect(board.teams.map((t) => t.name)).toEqual(["Seu time · Azul", "Adversário · Vermelho"]);
    expect(board.teams[0]!.players).toHaveLength(5);
    expect(board.teams.flatMap((t) => t.players).filter((p) => p.isYou)).toHaveLength(1);
    expect(board).toMatchObject({ result: "win", own: 13, enemy: 9 });
  });

  it("reports the viewer's loss from the losing side", () => {
    const { row, players } = stored({ blueRounds: 5, redRounds: 13 });
    const board = buildScoreboard(row, players, ME_PUUID);
    expect(board).toMatchObject({ result: "loss", own: 5, enemy: 13 });
    expect(board.teams[1]!.result).toBe("win");
  });

  it("handles draws", () => {
    const { row, players } = stored({ blueRounds: 12, redRounds: 12 });
    const board = buildScoreboard(row, players, ME_PUUID);
    expect(board.result).toBe("draw");
    expect(board.teams.every((t) => t.result === "draw")).toBe(true);
  });

  it("refuses to build a board for someone who didn't play", () => {
    const { row, players } = stored();
    expect(() => buildScoreboard(row, players, "someone-else")).toThrow();
  });
});
