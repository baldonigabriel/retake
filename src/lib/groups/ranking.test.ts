import { describe, expect, it } from "vitest";

import { ALL_MODES } from "@/lib/stats/aggregate";

import {
  MVP_MIN_MATCHES,
  MVP_RULE,
  buildRanking,
  parseMetric,
  togetherMatches,
  weekModes,
  weekMvp,
  type GroupLine,
  type GroupMember,
} from "./ranking";
import { previousWeek, weekRange } from "./week";

const week = weekRange(new Date("2026-11-05T18:00:00Z")); // 02/11 → 08/11
const prev = previousWeek(week);
const THIS_WEEK = new Date("2026-11-04T22:00:00Z");
const LAST_WEEK = new Date("2026-10-28T22:00:00Z");

const member = (id: string, extra: Partial<GroupMember> = {}): GroupMember => ({
  userId: `u-${id}`,
  puuid: `p-${id}`,
  name: id,
  tag: "BR1",
  image: null,
  role: "member",
  isYou: false,
  ...extra,
});

let seq = 0;
function line(puuid: string, over: Partial<GroupLine> = {}): GroupLine {
  seq++;
  return {
    puuid,
    matchId: `m${seq}`,
    startedAt: THIS_WEEK,
    queueId: "competitive",
    mode: "Competitive",
    mapId: null,
    mapName: "Ascent",
    roundsPlayed: 20,
    winningTeam: "Blue",
    redScore: 7,
    blueScore: 13,
    team: "Blue",
    agentId: null,
    agentName: "Jett",
    won: true,
    kills: 20,
    deaths: 10,
    assists: 5,
    score: 5000, // ACS 250
    damageDealt: 3000,
    headshots: 10,
    bodyshots: 30,
    legshots: 2,
    ...over,
  };
}

const ana = member("Ana", { isYou: true, role: "owner" });
const bia = member("Bia");
const caio = member("Caio");
const semConta = member("Duda", { puuid: null, tag: null });

describe("buildRanking", () => {
  const lines = [
    line("p-Ana", { score: 4000 }), // ACS 200
    line("p-Ana", { score: 6000, won: false, winningTeam: "Red" }), // ACS 300 → avg 250
    line("p-Bia", { score: 6000 }), // ACS 300
    line("p-Bia", { startedAt: LAST_WEEK, score: 5000 }), // last week: 250
    line("p-Caio", { queueId: "unrated", score: 10000 }), // other mode
    line("p-Ana", { startedAt: new Date("2026-11-10T12:00:00Z"), score: 99999 }), // next week: ignored
  ];

  it("ranks this week's competitive ACS, weighted by rounds, best first", () => {
    const r = buildRanking([ana, bia, caio, semConta], lines, { week, previousWeek: prev });
    expect(r.mode).toBe("competitive");
    expect(r.ranked.map((e) => [e.member.name, Math.round(e.value)])).toEqual([
      ["Bia", 300],
      ["Ana", 250],
    ]);
    expect(r.ranked[0]!.previous).toBe(250);
    expect(r.ranked[1]!.previous).toBeNull();
  });

  it("lists who didn't play in that mode (and members without a Riot account) as idle, never mixing modes", () => {
    const r = buildRanking([ana, bia, caio, semConta], lines, { week, previousWeek: prev });
    expect(r.idle.map((m) => m.name)).toEqual(["Caio", "Duda"]);
    const unrated = buildRanking([ana, bia, caio], lines, { week, previousWeek: prev, mode: "unrated" });
    expect(unrated.ranked.map((e) => e.member.name)).toEqual(["Caio"]);
  });

  it("supports win rate and matches played; ties go to who played more, then by name", () => {
    const wr = buildRanking([ana, bia], lines, { week, previousWeek: prev, metric: "winrate" });
    expect(wr.ranked.map((e) => [e.member.name, e.value])).toEqual([
      ["Bia", 1],
      ["Ana", 0.5],
    ]);
    const played = buildRanking([ana, bia], lines, { week, previousWeek: prev, metric: "matches" });
    expect(played.ranked.map((e) => [e.member.name, e.value])).toEqual([
      ["Ana", 2],
      ["Bia", 1],
    ]);
    const tie = buildRanking([bia, ana], [line("p-Ana"), line("p-Bia")], { week, previousWeek: prev, metric: "kd" });
    expect(tie.ranked.map((e) => e.member.name)).toEqual(["Ana", "Bia"]);
  });

  it("K/D uses max(deaths, 1) over the week totals", () => {
    const r = buildRanking([ana], [line("p-Ana", { kills: 12, deaths: 0 }), line("p-Ana", { kills: 8, deaths: 10 })], {
      week,
      previousWeek: prev,
      metric: "kd",
    });
    expect(r.ranked[0]!.value).toBe(2);
  });

  it("can explicitly mix modes", () => {
    const r = buildRanking([caio], lines, { week, previousWeek: prev, mode: ALL_MODES });
    expect(r.ranked).toHaveLength(1);
  });

  it("parses the metric from the URL", () => {
    expect(parseMetric("kd")).toBe("kd");
    expect(parseMetric("hs")).toBe("acs");
  });
});

describe("weekModes", () => {
  it("offers competitive first, the week's other modes, then 'all'", () => {
    expect(weekModes([line("p-Ana", { queueId: "unrated" }), line("p-Bia")], week)).toEqual(["competitive", "unrated", ALL_MODES]);
    // Only one mode actually played: nothing to mix.
    expect(weekModes([line("p-Ana", { queueId: "unrated" })], week)).toEqual(["competitive", "unrated"]);
    expect(weekModes([line("p-Ana")], week)).toEqual(["competitive"]);
    expect(weekModes([line("p-Ana", { queueId: "unrated", startedAt: LAST_WEEK })], week)).toEqual(["competitive"]);
  });
});

describe("weekMvp", () => {
  const three = (puuid: string, score: number, over: Partial<GroupLine> = {}) =>
    Array.from({ length: MVP_MIN_MATCHES }, () => line(puuid, { score, ...over }));

  it("is the best competitive ACS among members with the minimum matches", () => {
    const mvp = weekMvp([ana, bia, caio], [...three("p-Ana", 5000), ...three("p-Bia", 6000), line("p-Caio", { score: 9000 })], week);
    expect(mvp?.member.name).toBe("Bia");
    expect(Math.round(mvp!.summary.acs)).toBe(300);
  });

  it("ignores other modes and other weeks", () => {
    expect(weekMvp([ana], three("p-Ana", 9000, { queueId: "unrated" }), week)).toBeNull();
    expect(weekMvp([ana], three("p-Ana", 9000, { startedAt: LAST_WEEK }), week)).toBeNull();
  });

  it("breaks an ACS tie by K/D", () => {
    const mvp = weekMvp([ana, bia], [...three("p-Ana", 5000, { deaths: 20 }), ...three("p-Bia", 5000, { deaths: 10 })], week);
    expect(mvp?.member.name).toBe("Bia");
  });

  it("has a one-line rule for the screen", () => {
    expect(MVP_RULE).toContain(`${MVP_MIN_MATCHES} partidas`);
    expect(MVP_RULE).not.toContain("\n");
  });
});

describe("togetherMatches", () => {
  const shared = (puuid: string, matchId: string, over: Partial<GroupLine> = {}) => line(puuid, { matchId, ...over });

  it("finds matches with 2+ members on the same team and picks the standout", () => {
    const lines = [
      shared("p-Ana", "duo", { score: 4000, kills: 15 }),
      shared("p-Bia", "duo", { score: 7000, kills: 25 }),
      shared("p-Ana", "solo"),
      // Opposite teams: not "together".
      shared("p-Ana", "rivals", { team: "Blue" }),
      shared("p-Caio", "rivals", { team: "Red", won: false }),
      // A non-member in the same team never shows up.
      shared("stranger", "solo"),
    ];
    const found = togetherMatches([ana, bia, caio], lines);
    expect(found.map((m) => m.matchId)).toEqual(["duo"]);
    expect(found[0]!.players.map((p) => p.member.name)).toEqual(["Bia", "Ana"]);
    expect(found[0]!.standout.member.name).toBe("Bia");
    expect(found[0]!.standout.acs).toBe(350);
    expect(found[0]).toMatchObject({ result: "win", own: 13, enemy: 7 });
  });

  it("reports the team's result (draws too) and sorts newest first", () => {
    const lines = [
      shared("p-Ana", "old", { startedAt: LAST_WEEK, team: "Red", won: false }),
      shared("p-Bia", "old", { startedAt: LAST_WEEK, team: "Red", won: false }),
      shared("p-Ana", "draw", { winningTeam: null, won: false, redScore: 12, blueScore: 12 }),
      shared("p-Bia", "draw", { winningTeam: null, won: false, redScore: 12, blueScore: 12 }),
    ];
    const found = togetherMatches([ana, bia], lines);
    expect(found.map((m) => [m.matchId, m.result])).toEqual([
      ["draw", "draw"],
      ["old", "loss"],
    ]);
    expect(found[1]).toMatchObject({ own: 7, enemy: 13 });
  });

  it("respects the limit", () => {
    const lines = Array.from({ length: 6 }, (_, i) => [shared("p-Ana", `x${i}`), shared("p-Bia", `x${i}`)]).flat();
    expect(togetherMatches([ana, bia], lines, 4)).toHaveLength(4);
  });
});
