import { describe, expect, it } from "vitest";

import { CARD_COLORS, buildMatchCard, buildTestCard, escapeMarkdown, pickHighlight, type CardMatch, type CardPlayer } from "./card";

const JETT = "add6443a-41bd-e414-f6ad-e58d267f4e95";
const ASCENT = "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319";

const match: CardMatch = {
  id: "m-1",
  mapId: ASCENT,
  mapName: "Ascent",
  queueId: "competitive",
  mode: "Competitive",
  startedAt: new Date("2026-11-05T21:00:00Z"),
  gameLengthMs: 2_154_000,
  roundsPlayed: 22,
  redScore: 13,
  blueScore: 9,
  winningTeam: "Red",
};

function player(puuid: string, team: string, score: number, extra: Partial<CardPlayer> = {}): CardPlayer {
  return {
    puuid,
    gameName: puuid,
    team,
    agentId: JETT,
    agentName: "Jett",
    kills: 20,
    deaths: 14,
    assists: 5,
    score,
    damageDealt: 3476,
    headshots: 10,
    bodyshots: 30,
    legshots: 2,
    won: team === "Red",
    ...extra,
  };
}

// ACS: top 6600/22 = 300; you 5302/22 = 241.
const players = [
  player("enemy-top", "Blue", 6600),
  player("you", "Red", 5302, { gameName: "Gabs", kills: 24, deaths: 14 }),
  player("friend", "Red", 4000, { gameName: "Parça", agentName: "Sova" }),
  player("red-3", "Red", 3000),
  player("red-4", "Red", 2900),
  player("red-5", "Red", 2800),
  player("blue-2", "Blue", 3500),
  player("blue-3", "Blue", 3400),
  player("blue-4", "Blue", 3300),
  player("blue-5", "Blue", 3200),
];

describe("buildMatchCard", () => {
  it("titles the card with result, map and the members' score", () => {
    const card = buildMatchCard({ match, players, memberPuuids: ["you"], groupName: "Os Parças", appUrl: "https://retake.app/" });
    const [embed] = card.embeds;
    expect(embed!.title).toBe("Vitória em Ascent · 13–9");
    expect(embed!.color).toBe(CARD_COLORS.win);
    expect(embed!.url).toBe("https://retake.app/match/m-1");
    expect(embed!.description).toBe("Competitivo · 35:54 · <t:1793912400:R>");
    expect(embed!.footer?.text).toBe("Os Parças · Retake");
  });

  it("shows ACS, K/D, HS% and ADR per member, computed with the app's formulas", () => {
    const [embed] = buildMatchCard({ match, players, memberPuuids: ["you"], groupName: "G" }).embeds;
    expect(embed!.fields![0]).toEqual({
      name: "Gabs · Jett",
      value: "ACS **241** · K/D **1,71** · 24/14/5\nHS% **23,8%** · ADR **158**",
    });
  });

  it("lists every member who played in one card, best ACS first, plus the highlight", () => {
    const [embed] = buildMatchCard({ match, players, memberPuuids: ["friend", "you", "not-in-match"], groupName: "G" }).embeds;
    expect(embed!.fields!.map((f) => f.name)).toEqual(["Gabs · Jett", "Parça · Sova", "Destaque"]);
    expect(embed!.fields![2]!.value).toBe("**Gabs** de Jett: maior ACS do time (241)");
  });

  it("uses the loss colour and the members' side of the score on a loss", () => {
    const [embed] = buildMatchCard({ match, players, memberPuuids: ["blue-2"], groupName: "G" }).embeds;
    expect(embed!.title).toBe("Derrota em Ascent · 9–13");
    expect(embed!.color).toBe(CARD_COLORS.loss);
  });

  it("calls a draw a draw", () => {
    const draw = { ...match, redScore: 12, blueScore: 12, winningTeam: null };
    const drawPlayers = players.map((p) => ({ ...p, won: false }));
    const [embed] = buildMatchCard({ match: draw, players: drawPlayers, memberPuuids: ["you"], groupName: "G" }).embeds;
    expect(embed!.title).toBe("Empate em Ascent · 12–12");
    expect(embed!.color).toBe(CARD_COLORS.draw);
  });

  it("handles members on opposite teams with a V/D per member instead of one result", () => {
    const [embed] = buildMatchCard({ match, players, memberPuuids: ["you", "blue-2"], groupName: "G" }).embeds;
    expect(embed!.title).toBe("Grupo dos dois lados em Ascent · 13–9");
    expect(embed!.fields!.map((f) => f.name.slice(0, 4))).toEqual(["V · ", "D · ", "Dest"]);
  });

  it("never pings: mentions are disabled and names can't inject markdown", () => {
    const sneaky = players.map((p) => (p.puuid === "you" ? { ...p, gameName: "@everyone **x**" } : p));
    const card = buildMatchCard({ match, players: sneaky, memberPuuids: ["you"], groupName: "G" });
    expect(card.allowed_mentions).toEqual({ parse: [] });
    expect(card.embeds[0]!.fields![0]!.name).toBe("@everyone \\*\\*x\\*\\* · Jett");
  });

  it("refuses to build a card for a match no member played", () => {
    expect(() => buildMatchCard({ match, players, memberPuuids: ["stranger"], groupName: "G" })).toThrow();
  });
});

describe("pickHighlight", () => {
  it("says when the member had the best ACS of the whole match", () => {
    expect(pickHighlight(match, players, [players[0]!])?.label).toBe("maior ACS da partida");
  });

  it("gives the placement when they weren't the best of their team", () => {
    expect(pickHighlight(match, players, [players[2]!])?.label).toBe("3º maior ACS da partida");
  });
});

describe("buildTestCard", () => {
  it("uses the brand colour and names the group", () => {
    const card = buildTestCard({ groupName: "Os_Parças", now: new Date("2026-11-05T21:00:00Z") });
    expect(card.embeds[0]!.color).toBe(CARD_COLORS.brand);
    expect(card.embeds[0]!.description).toContain("**Os\\_Parças**");
    expect(card.allowed_mentions).toEqual({ parse: [] });
  });
});

describe("escapeMarkdown", () => {
  it("escapes Discord formatting characters", () => {
    expect(escapeMarkdown("a_b*c~d`e|f")).toBe("a\\_b\\*c\\~d\\`e\\|f");
  });
});
