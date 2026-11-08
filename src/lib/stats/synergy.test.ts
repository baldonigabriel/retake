import { describe, expect, it } from "vitest";

import {
  SYNERGY_MIN_MATCHES,
  SYNERGY_RELIABLE_MATCHES,
  synergy,
  synergyTrend,
  type MateAppearance,
  type SynergyLine,
  type SynergyMate,
} from "./synergy";

const ME = "me-puuid";
const base = Date.parse("2026-11-01T22:00:00Z");

let seq = 0;
function line(overrides: Partial<SynergyLine> = {}): SynergyLine {
  seq++;
  return {
    matchId: `m${seq}`,
    startedAt: new Date(base + seq * 3_600_000),
    team: "Blue",
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
    ...overrides,
  };
}

const loss = (o: Partial<SynergyLine> = {}) => line({ won: false, winningTeam: "Red", kills: 10, deaths: 20, score: 3000, ...o });

function mate(puuid: string, lines: readonly SynergyLine[], team?: string): SynergyMate<{ name: string }> {
  return { puuid, mate: { name: puuid }, appearances: lines.map((l): MateAppearance => ({ matchId: l.matchId, team: team ?? l.team })) };
}

describe("synergy", () => {
  it("computes the viewer's numbers on the same team and compares them with their average", () => {
    const withAna = [line(), line(), line(), loss()]; // 3–1 together
    const solo = [loss(), loss(), loss(), loss()]; // 0–4 without
    const r = synergy(ME, [...withAna, ...solo], [mate("ana", withAna)]);

    expect(r.baseline.matches).toBe(8);
    expect(r.baseline.winRate.rate).toBe(3 / 8);
    expect(r.duos).toHaveLength(1);
    const duo = r.duos[0]!;
    expect(duo.summary.matches).toBe(4);
    expect(duo.summary.winRate.rate).toBe(0.75);
    expect(duo.winRateDelta).toBeCloseTo(0.75 - 0.375);
    // Volume weighted: (3×20 + 10) kills / (3×10 + 20) deaths
    expect(duo.summary.kd).toBeCloseTo(70 / 50);
    expect(duo.summary.acs).toBeCloseTo((3 * 4000 + 3000) / 80);
    expect(duo.acsDelta).toBeCloseTo(duo.summary.acs - r.baseline.acs);
    expect(duo.kdDelta).toBeCloseTo(duo.summary.kd - r.baseline.kd);
    expect(duo.smallSample).toBe(true);
  });

  it("ignores matches where the mate was on the other team", () => {
    const shared = [line(), line(), line()];
    const r = synergy(ME, shared, [mate("rival", shared, "Red")]);
    expect(r.duos).toEqual([]);
    expect(r.tooFew).toEqual([]);
  });

  it("compares team names without caring about case", () => {
    const shared = [line(), line(), line()];
    expect(synergy(ME, shared, [mate("ana", shared, "blue")]).duos).toHaveLength(1);
  });

  it("only counts matches the viewer has in the selected mode", () => {
    const comp = [line(), line()];
    const unrated = [line({ queueId: "unrated" }), line({ queueId: "unrated" })];
    const all = [...comp, ...unrated];

    const competitive = synergy(ME, all, [mate("ana", all)]);
    expect(competitive.duos).toEqual([]);
    expect(competitive.tooFew).toEqual([{ mate: { name: "ana" }, puuid: "ana", matches: 2 }]);
    expect(competitive.baseline.matches).toBe(2);

    const mixed = synergy(ME, all, [mate("ana", all)], { mode: "all" });
    expect(mixed.mode).toBe("all");
    expect(mixed.duos[0]!.summary.matches).toBe(4);
  });

  it(`hides duos with fewer than ${SYNERGY_MIN_MATCHES} matches, reporting them apart`, () => {
    const two = [line(), line()];
    const r = synergy(ME, two, [mate("ana", two)]);
    expect(r.duos).toEqual([]);
    expect(r.tooFew).toHaveLength(1);
    expect(r.tooFew[0]!.matches).toBe(2);
  });

  it("lists reliable duos before small samples, even with a lower win rate", () => {
    const big = [...Array.from({ length: 6 }, () => line()), ...Array.from({ length: 6 }, () => loss())]; // 50% in 12
    const small = [line(), line(), line()]; // 100% in 3
    const r = synergy(ME, [...big, ...small], [mate("small", small), mate("big", big)]);
    expect(r.duos.map((d) => d.puuid)).toEqual(["big", "small"]);
    expect(r.duos[0]!.smallSample).toBe(false);
    expect(r.duos[0]!.summary.matches).toBeGreaterThanOrEqual(SYNERGY_RELIABLE_MATCHES);
    expect(r.duos[1]!.smallSample).toBe(true);
  });

  it("breaks win-rate ties by matches together, then by ACS", () => {
    const a = [line(), line(), line(), line()];
    const b = [line(), line(), line()];
    const c = [line({ score: 5000 }), line({ score: 5000 }), line({ score: 5000 })];
    const r = synergy(ME, [...a, ...b, ...c], [mate("b", b), mate("c", c), mate("a", a)]);
    expect(r.duos.map((d) => d.puuid)).toEqual(["a", "c", "b"]);
  });

  it("never pairs the viewer with themselves and counts a mate listed twice once", () => {
    const lines = [line(), line(), line()];
    const r = synergy(ME, lines, [mate(ME, lines), mate("ana", lines), mate("ana", lines)]);
    expect(r.duos.map((d) => d.puuid)).toEqual(["ana"]);
  });

  it("counts a match once even if the appearance is repeated, and ignores matches the viewer doesn't have", () => {
    const lines = [line(), line(), line()];
    const entry = mate("ana", lines);
    const repeated: SynergyMate<{ name: string }> = {
      ...entry,
      appearances: [...entry.appearances, ...entry.appearances, { matchId: "not-mine", team: "Blue" }],
    };
    expect(synergy(ME, lines, [repeated]).duos[0]!.summary.matches).toBe(3);
  });

  it("lists match ids newest first", () => {
    const lines = [line(), line(), line()];
    const shuffled = [lines[1]!, lines[2]!, lines[0]!];
    expect(synergy(ME, shuffled, [mate("ana", lines)]).duos[0]!.matchIds).toEqual([lines[2]!.matchId, lines[1]!.matchId, lines[0]!.matchId]);
  });

  it("treats draws as non-wins", () => {
    const lines = [line(), line({ won: false, winningTeam: null }), line({ won: false, winningTeam: null })];
    const duo = synergy(ME, lines, [mate("ana", lines)]).duos[0]!;
    expect(duo.summary.winRate).toMatchObject({ wins: 1, losses: 0, draws: 2 });
    expect(duo.summary.winRate.rate).toBeCloseTo(1 / 3);
  });

  it("returns an empty result with no lines or no mates", () => {
    const empty = synergy(ME, [], []);
    expect(empty.duos).toEqual([]);
    expect(empty.baseline.matches).toBe(0);
    expect(empty.baseline.winRate.rate).toBe(0);
    expect(synergy(ME, [line()], []).duos).toEqual([]);
    expect(synergy(ME, [], [mate("ana", [line(), line(), line()])]).duos).toEqual([]);
  });

  it("accepts a custom minimum and reliable threshold", () => {
    const lines = [line(), line()];
    const r = synergy(ME, lines, [mate("ana", lines)], { minMatches: 2, reliableMatches: 2 });
    expect(r.duos[0]!.smallSample).toBe(false);
    // A minimum below 1 behaves like 1: one match together is listed, none isn't.
    const one = [line()];
    expect(synergy(ME, one, [mate("x", one)], { minMatches: 0 }).duos).toHaveLength(1);
    expect(synergy(ME, one, [mate("x", one, "Red")], { minMatches: 0 }).duos).toEqual([]);
  });

  it("has zero delta when every match was played together", () => {
    const lines = [line(), loss(), line()];
    const duo = synergy(ME, lines, [mate("ana", lines)]).duos[0]!;
    expect(duo.winRateDelta).toBe(0);
    expect(duo.acsDelta).toBe(0);
  });
});

describe("synergyTrend", () => {
  it("reads small differences as 'parecido'", () => {
    expect(synergyTrend(0.13)).toBe("up");
    expect(synergyTrend(-0.08)).toBe("down");
    expect(synergyTrend(0.03)).toBe("flat");
    expect(synergyTrend(-0.03)).toBe("flat");
    expect(synergyTrend(0)).toBe("flat");
  });
});
