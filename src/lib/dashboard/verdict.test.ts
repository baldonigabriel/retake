import { describe, expect, it } from "vitest";

import { summarize, type PlayerMatchLine } from "@/lib/stats";
import type { RecentComparison } from "@/lib/stats/breakdown";

import { verdict } from "./verdict";

function lines(n: number, score: number): PlayerMatchLine[] {
  return Array.from({ length: n }, () => ({
    queueId: "competitive",
    roundsPlayed: 20,
    winningTeam: "Blue",
    won: true,
    kills: 10,
    deaths: 10,
    assists: 2,
    score,
    damageDealt: 2000,
    headshots: 5,
    bodyshots: 20,
    legshots: 1,
  }));
}

function cmp(recent: PlayerMatchLine[], all: PlayerMatchLine[], comparable = true): RecentComparison {
  return { recent: summarize(recent), overall: summarize(all), comparable };
}

describe("verdict", () => {
  it("is null without matches", () => {
    expect(verdict(cmp([], [], false), 20)).toBeNull();
  });

  it("says it's too early when everything is in the window", () => {
    const all = lines(9, 4760);
    expect(verdict(cmp(all, all, false), 20)).toBe("Com 9 partidas, ainda é cedo para comparar. Seu ACS médio é 238.");
  });

  it("answers yes / not yet / stable", () => {
    const recent = lines(20, 5000); // ACS 250
    const older = lines(20, 4000); // ACS 200
    expect(verdict(cmp(recent, [...recent, ...older]), 20)).toBe(
      "Sim: seu ACS nas últimas 20 é 250, 25 acima da sua média de 40 partidas.",
    );
    expect(verdict(cmp(older, [...recent, ...older]), 20)).toMatch(/^Ainda não: .* 25 abaixo/);
    expect(verdict(cmp(recent, [...recent, ...lines(5, 4980)]), 20)).toMatch(/^Estável/);
  });
});
