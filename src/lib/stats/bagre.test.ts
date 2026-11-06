import { describe, expect, it } from "vitest";

import { MAX_KD, MIN_LOSS_MARGIN, suggestCandidates, teamScore, type BagreLine, type BagreMember } from "./bagre";

const members: BagreMember[] = [
  { userId: "u-ana", puuid: "p-ana", name: "Ana" },
  { userId: "u-joao", puuid: "p-joao", name: "João" },
  { userId: "u-bia", puuid: "p-bia", name: "Bia" },
  { userId: "u-sem", puuid: null, name: "Sem Riot" },
];

let seq = 0;
/** A 24-round match; `own`–`enemy` from the player's side (Blue). */
function line(puuid: string, over: Partial<BagreLine> & { own?: number; enemy?: number; acs?: number } = {}): BagreLine {
  const own = over.own ?? 13;
  const enemy = over.enemy ?? 11;
  const rounds = own + enemy;
  const won = own > enemy;
  seq++;
  return {
    puuid,
    matchId: over.matchId ?? `m-${seq}`,
    startedAt: over.startedAt ?? new Date(Date.UTC(2026, 10, 3, 12, seq)),
    mapName: "mapName" in over ? (over.mapName ?? null) : "Lotus",
    agentName: "agentName" in over ? (over.agentName ?? null) : "Jett",
    team: "Blue",
    blueScore: own,
    redScore: enemy,
    queueId: over.queueId ?? "competitive",
    roundsPlayed: rounds,
    winningTeam: own === enemy ? null : won ? "Blue" : "Red",
    won,
    kills: over.kills ?? 18,
    deaths: over.deaths ?? 15,
    assists: over.assists ?? 5,
    score: Math.round((over.acs ?? 220) * rounds),
    damageDealt: 3000,
    headshots: 10,
    bodyshots: 30,
    legshots: 2,
  };
}

describe("suggestCandidates", () => {
  it("is empty without matches", () => {
    expect(suggestCandidates(members, [], { minMatches: 3 })).toEqual([]);
  });

  it("suggests the lowest average ACS, the roughest K/D and the heaviest loss, one person each", () => {
    const lines = [
      // João: 3 matches, lowest average; his worst is 98 on Lotus
      line("p-joao", { acs: 150 }),
      line("p-joao", { acs: 98, mapName: "Lotus" }),
      line("p-joao", { acs: 180 }),
      // Ana: 3 matches, higher average, one match with K/D 0,31
      line("p-ana", { acs: 260 }),
      line("p-ana", { acs: 240, kills: 4, deaths: 13, assists: 2, mapName: "Bind", agentName: "Sage" }),
      line("p-ana", { acs: 250 }),
      // Bia: lost 3–13 on Haven
      line("p-bia", { own: 3, enemy: 13, acs: 170, mapName: "Haven" }),
    ];
    const result = suggestCandidates(members, lines, { minMatches: 3 });
    expect(result.map((s) => [s.userId, s.kind])).toEqual([
      ["u-joao", "low_acs"],
      ["u-ana", "rough_match"],
      ["u-bia", "heavy_loss"],
    ]);
    expect(result[0]!.reason).toBe("ACS médio 143 em 3 competitivas; a pior foi 98 na Lotus");
    expect(result[0]!.matchId).toBe(lines[1]!.matchId);
    expect(result[1]!.reason).toBe("K/D 0,31 (4/13/2) de Sage na Bind");
    expect(result[2]!.reason).toBe("Perdeu de 3 a 13 na Haven, com ACS 170");
  });

  it("skips someone already suggested and takes the next person who meets the criterion", () => {
    const lines = [
      line("p-joao", { acs: 90 }),
      line("p-joao", { acs: 95, kills: 2, deaths: 14 }), // João also has the worst K/D...
      line("p-joao", { acs: 100, own: 2, enemy: 13 }), // ...and the worst loss
      line("p-ana", { acs: 200 }),
      line("p-ana", { acs: 210 }),
      line("p-ana", { acs: 220, kills: 6, deaths: 14 }), // second worst K/D
      line("p-bia", { own: 5, enemy: 13 }), // second worst loss
    ];
    const result = suggestCandidates(members, lines, { minMatches: 3 });
    expect(result.map((s) => [s.userId, s.kind])).toEqual([
      ["u-joao", "low_acs"],
      ["u-ana", "rough_match"],
      ["u-bia", "heavy_loss"],
    ]);
  });

  it("needs the minimum matches and at least two people for the average", () => {
    const lines = [line("p-joao", { acs: 90 }), line("p-joao", { acs: 90 }), line("p-ana", { acs: 300 })];
    expect(suggestCandidates(members, lines, { minMatches: 3 })).toEqual([]);
    // Daily minimum is 2, but Ana has only one match: still nobody to compare with.
    expect(suggestCandidates(members, lines, { minMatches: 2 })).toEqual([]);
    const daily = [...lines, line("p-ana", { acs: 280 })];
    expect(suggestCandidates(members, daily, { minMatches: 2 }).map((s) => s.userId)).toEqual(["u-joao"]);
  });

  it("only counts competitive matches", () => {
    const lines = [
      line("p-joao", { queueId: "unrated", kills: 1, deaths: 15 }),
      line("p-joao", { queueId: "deathmatch", own: 0, enemy: 13 }),
    ];
    expect(suggestCandidates(members, lines, { minMatches: 3 })).toEqual([]);
  });

  it("ignores lines of non-members and members without a Riot ID", () => {
    const lines = [line("p-stranger", { kills: 0, deaths: 20 }), line("p-none", { own: 0, enemy: 13 })];
    expect(suggestCandidates(members, lines, { minMatches: 3 })).toEqual([]);
  });

  it(`leaves out K/D above ${MAX_KD} and losses closer than ${MIN_LOSS_MARGIN} rounds`, () => {
    const lines = [
      line("p-joao", { kills: 12, deaths: 15 }), // 0,80
      line("p-ana", { own: 8, enemy: 13 }), // lost by 5
      line("p-bia", { own: 13, enemy: 2 }), // a win doesn't count however big
    ];
    expect(suggestCandidates(members, lines, { minMatches: 3 })).toEqual([]);
  });

  it("breaks K/D ties by more deaths, then the more recent match", () => {
    const older = line("p-ana", { kills: 3, deaths: 10, startedAt: new Date("2026-11-03T10:00:00Z") });
    const moreDeaths = line("p-bia", { kills: 6, deaths: 20 });
    const [first] = suggestCandidates(members, [older, moreDeaths], { minMatches: 3 });
    expect(first!.userId).toBe("u-bia");

    const a = line("p-ana", { kills: 3, deaths: 10, startedAt: new Date("2026-11-03T10:00:00Z") });
    const b = line("p-bia", { kills: 3, deaths: 10, startedAt: new Date("2026-11-04T10:00:00Z") });
    expect(suggestCandidates(members, [a, b], { minMatches: 3 })[0]!.userId).toBe("u-bia");
  });

  it("respects the limit", () => {
    const lines = [line("p-ana", { kills: 1, deaths: 15 }), line("p-bia", { own: 1, enemy: 13 })];
    expect(suggestCandidates(members, lines, { minMatches: 3, limit: 1 })).toHaveLength(1);
  });

  it("works without a map or agent name", () => {
    const [s] = suggestCandidates(members, [line("p-ana", { kills: 2, deaths: 12, mapName: null, agentName: null })], { minMatches: 3 });
    expect(s!.reason).toBe("K/D 0,17 (2/12/5)");
  });
});

describe("teamScore", () => {
  it("reads the player's side", () => {
    expect(teamScore({ team: "Red", redScore: 3, blueScore: 13 })).toEqual({ own: 3, enemy: 13 });
    expect(teamScore({ team: "Blue", redScore: 3, blueScore: 13 })).toEqual({ own: 13, enemy: 3 });
    expect(teamScore({ team: "Blue", redScore: null, blueScore: 13 })).toBeNull();
  });
});
