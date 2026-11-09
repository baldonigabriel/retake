import { describe, expect, it } from "vitest";

import {
  calculatePlayerRoundMetrics,
  economyBand,
  type KillSample,
  type RoundContext,
  type RoundPlayerSample,
} from "./metrics";

const me = "me";
const ally = "ally";
const context: RoundContext = {
  matchId: "m1",
  round: 1,
  winningTeam: "Blue",
  attackingTeam: "Blue",
  mapName: "Ascent",
  queueId: "competitive",
};
const player = (puuid: string, team: string, overrides: Partial<RoundPlayerSample> = {}): RoundPlayerSample => ({
  matchId: "m1",
  round: 1,
  puuid,
  team,
  weaponId: "vandal",
  weaponName: "Vandal",
  loadoutValue: 4_100,
  damage: 100,
  score: 250,
  headshots: 2,
  bodyshots: 6,
  legshots: 2,
  kills: 0,
  assists: 0,
  survived: true,
  ...overrides,
});
const kill = (
  seq: number,
  timeInRoundMs: number,
  killerPuuid: string | null,
  victimPuuid: string,
  assistants: string[] = [],
): KillSample => ({
  matchId: "m1",
  round: 1,
  seq,
  timeInRoundMs,
  killerPuuid,
  victimPuuid,
  assistants,
  weaponId: "vandal",
  weaponName: "Vandal",
  weaponType: "Rifle",
});

describe("calculatePlayerRoundMetrics", () => {
  it("matches a hand-checked 1v3 ace round", () => {
    const kills = [
      kill(0, 5_000, me, "e1"),
      kill(1, 10_000, "e2", ally),
      kill(2, 15_000, me, "e2"),
      kill(3, 20_000, me, "e3"),
      kill(4, 25_000, me, "e4"),
      kill(5, 30_000, me, "e5"),
    ];
    const metrics = calculatePlayerRoundMetrics({
      puuid: me,
      rounds: [context],
      players: [player(me, "Blue"), player(ally, "Blue", { survived: false }), ...["e1", "e2", "e3", "e4", "e5"].map((id) => player(id, "Red", { survived: false }))],
      kills,
    });
    expect(metrics.firstBlood).toEqual({ value: 1, successes: 1, sample: 1 });
    expect(metrics.firstDeath.successes).toBe(0);
    expect(metrics.multiKills.ace).toBe(1);
    expect(metrics.clutch[4]).toMatchObject({ situations: 1, wins: 1, rate: 1 });
    expect(metrics.kast).toEqual({ value: 1, successes: 1, sample: 1 });
    expect(metrics.economy[0]).toMatchObject({ band: "full", rounds: 1, wins: 1, acs: 250 });
    expect(metrics.sides[0]).toMatchObject({ mapName: "Ascent", attack: { value: 1, successes: 1, sample: 1 } });
    expect(metrics.weapons[0]).toMatchObject({ weaponName: "Vandal", kills: 5, shots: 10, hsRate: 0.2 });
  });

  it("counts a death as traded only inside five seconds", () => {
    const players = [player(me, "Blue", { survived: false }), player(ally, "Blue"), player("e1", "Red")];
    const inside = calculatePlayerRoundMetrics({
      puuid: me,
      rounds: [{ ...context, winningTeam: "Red" }],
      players,
      kills: [kill(0, 10_000, "e1", me), kill(1, 15_000, ally, "e1")],
    });
    const outside = calculatePlayerRoundMetrics({
      puuid: me,
      rounds: [{ ...context, winningTeam: "Red" }],
      players,
      kills: [kill(0, 10_000, "e1", me), kill(1, 15_001, ally, "e1")],
    });
    expect(inside.kast.successes).toBe(1);
    expect(outside.kast.successes).toBe(0);
  });

  it("ignores missing samples and reports zero as no denominator", () => {
    const metrics = calculatePlayerRoundMetrics({
      puuid: me,
      rounds: [context],
      players: [player(me, "Blue", { survived: null, loadoutValue: null, headshots: null })],
      kills: [],
    });
    expect(metrics.firstBlood).toEqual({ value: null, successes: 0, sample: 0 });
    expect(metrics.kast.value).toBeNull();
    expect(metrics.economy).toEqual([]);
    expect(metrics.weapons).toEqual([]);
  });
});

describe("economyBand", () => {
  it("uses the specified thresholds and separates pistol rounds", () => {
    expect(economyBand(0, 4_000)).toBe("pistol");
    expect(economyBand(1, 1_999)).toBe("eco");
    expect(economyBand(1, 2_000)).toBe("force");
    expect(economyBand(1, 3_899)).toBe("force");
    expect(economyBand(1, 3_900)).toBe("full");
  });
});
