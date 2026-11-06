import { describe, expect, it } from "vitest";

import { comparable, compareMembers, displayedValue, parseComparePeriod, resolvePair, type ComparableMember } from "./compare";
import type { GroupLine, GroupMember } from "./ranking";

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
    startedAt: new Date("2026-11-04T22:00:00Z"),
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

describe("comparable / resolvePair", () => {
  const you = member("ana", { isYou: true });
  const bia = member("bia");
  const cris = member("cris");
  const noRiot = member("dani", { puuid: null });
  const list = comparable([bia, you, noRiot, cris]);

  it("leaves out members without a Riot account", () => {
    expect(list.map((m) => m.name)).toEqual(["bia", "ana", "cris"]);
  });

  it("defaults to the viewer against the next member", () => {
    const pair = resolvePair(list, {});
    expect(pair?.a.name).toBe("ana");
    expect(pair?.b.name).toBe("bia");
  });

  it("uses the ids from the URL when both are members", () => {
    const pair = resolvePair(list, { a: "u-cris", b: "u-bia" });
    expect([pair?.a.name, pair?.b.name]).toEqual(["cris", "bia"]);
  });

  it("ignores ids that aren't comparable members, and never pairs someone with themselves", () => {
    expect(resolvePair(list, { a: "u-stranger", b: "u-dani" })).toMatchObject({ a: { name: "ana" }, b: { name: "bia" } });
    expect(resolvePair(list, { a: "u-bia", b: "u-bia" })).toMatchObject({ a: { name: "bia" }, b: { name: "ana" } });
  });

  it("needs two comparable members", () => {
    expect(resolvePair(comparable([you, noRiot]), {})).toBeNull();
  });
});

describe("compareMembers", () => {
  const a = member("ana", { isYou: true }) as ComparableMember;
  const b = member("bia") as ComparableMember;

  it("compares only the selected mode and marks the leader per metric", () => {
    const lines = [
      line("p-ana", { score: 5000, kills: 20, deaths: 10 }),
      line("p-bia", { score: 4000, kills: 10, deaths: 10, headshots: 20, bodyshots: 20 }),
      line("p-bia", { queueId: "unrated", score: 9000 }), // other mode: ignored
    ];
    const c = compareMembers(a, b, lines, "competitive");
    expect(c.a.summary.matches).toBe(1);
    expect(c.b.summary.matches).toBe(1);
    const row = (m: string) => c.rows.find((r) => r.metric === m)!;
    expect(row("acs")).toMatchObject({ a: 250, b: 200, leader: "a" });
    expect(row("kd").leader).toBe("a");
    expect(row("hs").leader).toBe("b");
    expect(row("winrate").leader).toBeNull(); // both 100%
  });

  it("ties on the displayed value", () => {
    expect(displayedValue("kd", 1.234)).toBe(displayedValue("kd", 1.2349));
    const lines = [line("p-ana", { score: 5001 }), line("p-bia", { score: 5004 })]; // 250,05 vs 250,2
    const c = compareMembers(a, b, lines);
    expect(c.rows.find((r) => r.metric === "acs")!.leader).toBeNull();
  });

  it("shows no values for a side without matches", () => {
    const c = compareMembers(a, b, [line("p-ana")]);
    expect(c.rows.every((r) => r.b === null && r.leader === null)).toBe(true);
  });

  it("counts matches together on the same team and who did better in them", () => {
    const lines = [
      line("p-ana", { matchId: "t1", score: 6000 }),
      line("p-bia", { matchId: "t1", score: 4000 }),
      line("p-ana", { matchId: "t2", score: 3000, won: false, winningTeam: "Red" }),
      line("p-bia", { matchId: "t2", score: 5000, won: false, winningTeam: "Red" }),
      // Opposite teams: not "together".
      line("p-ana", { matchId: "x1", team: "Red" }),
      line("p-bia", { matchId: "x1", team: "Blue" }),
    ];
    const c = compareMembers(a, b, lines);
    expect(c.together.map((m) => m.matchId).sort()).toEqual(["t1", "t2"]);
    expect(c.togetherRecord).toEqual({ wins: 1, losses: 1, draws: 0, aBetter: 1, bBetter: 1 });
  });

  it("finds each side's most played agent", () => {
    const lines = [line("p-ana", { agentName: "Sage" }), line("p-ana", { agentName: "Sage" }), line("p-ana", { agentName: "Jett" })];
    expect(compareMembers(a, b, lines).a.topAgent).toMatchObject({ name: "Sage", matches: 2 });
  });
});

describe("parseComparePeriod", () => {
  it("defaults to 30 days", () => {
    expect(parseComparePeriod("week")).toBe("week");
    expect(parseComparePeriod("nope")).toBe("30d");
  });
});
