import { describe, expect, it } from "vitest";

import { summarize, type PlayerMatchLine } from "@/lib/stats/aggregate";

import { duoHeadline, versusAverage } from "./display";

const win: PlayerMatchLine = {
  queueId: "competitive",
  roundsPlayed: 20,
  winningTeam: "Blue",
  won: true,
  kills: 20,
  deaths: 10,
  assists: 5,
  score: 4000,
  damageDealt: 3000,
  headshots: 10,
  bodyshots: 30,
  legshots: 0,
};
const loss: PlayerMatchLine = { ...win, won: false, winningTeam: "Red" };

const record = (wins: number, losses: number) =>
  summarize([...Array.from({ length: wins }, () => win), ...Array.from({ length: losses }, () => loss)]);

describe("versusAverage", () => {
  it("speaks in points above or below, with a dead zone", () => {
    expect(versusAverage(0.134)).toBe("13 pontos acima da sua média");
    expect(versusAverage(-0.06)).toBe("6 pontos abaixo da sua média");
    expect(versusAverage(0.02)).toBe("parecido com a sua média");
  });
});

describe("duoHeadline", () => {
  it("states the number for a reliable sample", () => {
    const summary = record(15, 7); // 68% in 22
    expect(duoHeadline({ mate: { name: "chupingole" }, summary, winRateDelta: 0.13, smallSample: false })).toBe(
      "Com chupingole você vence 68% em 22 partidas, 13 pontos acima da sua média.",
    );
  });

  it("frames a small sample as a trend", () => {
    const summary = record(1, 0);
    expect(duoHeadline({ mate: { name: "Ana" }, summary, winRateDelta: 0.5, smallSample: true })).toBe(
      "Com Ana a tendência é de 100% de vitórias em 1 partida, 50 pontos acima da sua média. Ainda é pouca partida para cravar.",
    );
  });
});
