import { describe, expect, it } from "vitest";

import { buildBagreCard } from "./card";
import type { NominatedLine } from "./display";
import type { ResultEntry, RoundResult } from "./results";

const line: NominatedLine = {
  puuid: "p-joao",
  matchId: "m-1",
  startedAt: new Date("2026-11-04T23:00:00Z"),
  mapName: "Lotus",
  mapId: null,
  mode: "Competitive",
  agentName: "Jett",
  agentId: null,
  team: "Red",
  redScore: 3,
  blueScore: 13,
  queueId: "competitive",
  roundsPlayed: 16,
  winningTeam: "Blue",
  won: false,
  kills: 4,
  deaths: 13,
  assists: 2,
  score: 1568, // ACS 98
  damageDealt: 900,
  headshots: 2,
  bodyshots: 10,
  legshots: 1,
};

const person = (name: string) => ({ userId: `u-${name}`, name, image: null, isYou: false, member: true });

const entry = (name: string, votes: number, over: Partial<ResultEntry> = {}): ResultEntry => ({
  nominationId: `n-${name}`,
  nominee: person(name),
  nominator: person("Ana"),
  comment: "Pixou o próprio pé no B",
  matchId: "m-1",
  line,
  viewerPlayed: false,
  votes,
  matches: 3,
  ...over,
});

const base: Omit<RoundResult, "outcome" | "entries" | "winner" | "tied" | "byTieBreak"> = {
  roundId: "r-1",
  cadence: "weekly",
  startsAt: new Date("2026-11-02T03:00:00Z"),
  endsAt: new Date("2026-11-09T03:00:00Z"),
  closedAt: new Date("2026-11-09T03:10:00Z"),
  votesCast: 4,
  badgeUntil: new Date("2026-11-16T03:00:00Z"),
};

describe("buildBagreCard", () => {
  it("announces the winner with the comment, the match line and link, and the votes", () => {
    const winner = entry("João", 3);
    const payload = buildBagreCard({
      groupName: "Os Parças",
      groupSlug: "os-parcas",
      appUrl: "https://retake.example",
      result: { ...base, outcome: "winner", entries: [winner, entry("Bia", 1)], winner, tied: [], byTieBreak: false },
    })!;
    const embed = payload.embeds[0]!;
    expect(embed.title).toBe("🐟 João é o Bagre da Semana");
    expect(embed.url).toBe("https://retake.example/groups/os-parcas/bagre");
    expect(embed.description).toBe("“Pixou o próprio pé no B”\n— indicação de Ana");
    expect(embed.fields![0]!.value).toBe(
      "Lotus · Competitivo · derrota 3–13 · Jett 4/13/2 · ACS 98\n[Ver partida](https://retake.example/match/m-1)",
    );
    expect(embed.fields![1]!.value).toBe("3 votos de 4");
    expect(embed.footer!.text).toBe("Os Parças · 2 – 8 de nov · fica com o selo até domingo, 15 de nov. Bola pra frente!");
    expect(payload.allowed_mentions).toEqual({ parse: [] });
  });

  it("says when the tie-break decided it", () => {
    const winner = entry("João", 2, { matches: 1 });
    const payload = buildBagreCard({
      groupName: "G",
      groupSlug: "g",
      result: { ...base, outcome: "winner", entries: [winner, entry("Bia", 2)], winner, tied: [], byTieBreak: true },
    })!;
    expect(payload.embeds[0]!.fields!.some((f) => f.name === "Desempate")).toBe(true);
  });

  it("announces a declared tie without a badge", () => {
    const a = entry("João", 2);
    const b = entry("Bia", 2);
    const payload = buildBagreCard({
      groupName: "G",
      groupSlug: "g",
      result: { ...base, cadence: "daily", outcome: "tie", entries: [a, b], winner: null, tied: [a, b], byTieBreak: false },
    })!;
    expect(payload.embeds[0]!.title).toBe("🐟 Empate declarado no Bagre do Dia");
    expect(payload.embeds[0]!.description).toContain("João e Bia empataram com 2 votos cada");
    expect(payload.embeds[0]!.fields).toHaveLength(2);
  });

  it("posts nothing when nobody voted or nobody was nominated", () => {
    for (const outcome of ["no_votes", "empty", "disabled"] as const) {
      expect(
        buildBagreCard({ groupName: "G", groupSlug: "g", result: { ...base, outcome, entries: [], winner: null, tied: [], byTieBreak: false } }),
      ).toBeNull();
    }
  });

  it("escapes markdown and never pings", () => {
    const winner = entry("**João**", 1, { comment: "@everyone olha isso _aqui_" });
    const payload = buildBagreCard({
      groupName: "G",
      groupSlug: "g",
      result: { ...base, outcome: "winner", entries: [winner], winner, tied: [], byTieBreak: false },
    })!;
    expect(payload.embeds[0]!.title).not.toContain("**João**");
    expect(payload.embeds[0]!.description).toContain("\\_aqui\\_");
    expect(payload.allowed_mentions.parse).toEqual([]);
  });

  it("works without a line (Riot ID unlinked) and without an app URL", () => {
    const winner = entry("João", 1, { line: null, nominator: null });
    const payload = buildBagreCard({
      groupName: "G",
      groupSlug: "g",
      result: { ...base, outcome: "winner", entries: [winner], winner, tied: [], byTieBreak: false },
    })!;
    expect(payload.embeds[0]!.fields![0]!.value).toBe("Partida indisponível");
    expect(payload.embeds[0]!.description).toContain("indicação de alguém do grupo");
    expect(payload.embeds[0]!.url).toBeUndefined();
  });
});
