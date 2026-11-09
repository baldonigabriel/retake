// @vitest-environment node
import { describe, expect, it } from "vitest";

import { ME_PUUID, rawMatch, rawMmrEntry, rawPlayer } from "@/lib/henrik/fixtures";
import { matchSchema, mmrHistoryEntrySchema, type HenrikMatch } from "@/lib/henrik/schemas";

import {
  includesPlayer,
  isStorable,
  queueIdOf,
  roundsPlayedOf,
  toKillRows,
  toMatchRow,
  toPlayerRows,
  toRoundPlayerRows,
  toRoundRows,
  toSnapshotRows,
} from "./map";

const parse = (raw: unknown): HenrikMatch => matchSchema.parse(raw);

describe("toMatchRow", () => {
  it("maps a won competitive match", () => {
    const row = toMatchRow(parse(rawMatch()));
    expect(row).toMatchObject({
      id: "11111111-1111-4111-8111-111111111111",
      mapName: "Ascent",
      mode: "Competitive",
      queueId: "competitive",
      roundsPlayed: 20,
      blueScore: 13,
      redScore: 7,
      winningTeam: "Blue",
      gameLengthMs: 2_100_000,
    });
    expect(row.startedAt).toEqual(new Date("2026-11-05T03:20:02.377Z"));
  });

  it("has no winning team on a draw", () => {
    const row = toMatchRow(parse(rawMatch({ blueRounds: 12, redRounds: 12 })));
    expect(row.winningTeam).toBeNull();
    expect(row.roundsPlayed).toBe(24);
  });

  it("falls back to team rounds when the round list is missing", () => {
    const raw = rawMatch() as Record<string, unknown>;
    delete raw.rounds;
    expect(roundsPlayedOf(parse(raw))).toBe(20);
  });

  it("labels an empty queue id as unknown", () => {
    expect(queueIdOf(parse(rawMatch({ queueId: "" })))).toBe("unknown");
  });
});

describe("toPlayerRows", () => {
  it("stores all 10 players with the result of their team", () => {
    const rows = toPlayerRows(parse(rawMatch()));
    expect(rows).toHaveLength(10);
    expect(rows.filter((r) => r.won)).toHaveLength(5);
    expect(rows.find((r) => r.puuid === ME_PUUID)).toMatchObject({
      team: "Blue",
      won: true,
      agentName: "Sage",
      tier: 21,
      damageDealt: 2900,
      headshots: 10,
    });
  });

  it("marks nobody as winner on a draw", () => {
    const rows = toPlayerRows(parse(rawMatch({ blueRounds: 12, redRounds: 12 })));
    expect(rows.every((r) => !r.won)).toBe(true);
  });

  it("handles modes without teams (deathmatch)", () => {
    const raw = { ...rawMatch({ queueId: "deathmatch" }), teams: [] };
    const match = parse(raw);
    expect(toMatchRow(match)).toMatchObject({ winningTeam: null, redScore: null, blueScore: null });
    expect(toPlayerRows(match).every((r) => !r.won)).toBe(true);
  });

  it("never writes the same puuid twice for one match", () => {
    const raw = rawMatch();
    raw.players.push(rawPlayer(0, { puuid: ME_PUUID }));
    expect(toPlayerRows(parse(raw))).toHaveLength(10);
  });
});

describe("round persistence mapping", () => {
  it("maps sides, economy samples and the ordered kill feed", () => {
    const match = parse(rawMatch());
    expect(toRoundRows(match)[0]).toMatchObject({
      round: 0,
      winningTeam: "Blue",
      attackingTeam: "Blue",
      result: "Elimination",
    });
    expect(toRoundRows(match)[1]).toMatchObject({ attackingTeam: "Red" });
    expect(toRoundPlayerRows(match).find((row) => row.puuid === ME_PUUID && row.round === 0)).toMatchObject({
      weaponName: "Vandal",
      loadoutValue: 800,
      spent: null,
      damage: 100,
      assists: 0,
      survived: true,
    });
    expect(toKillRows(match)).toEqual([
      expect.objectContaining({ round: 0, seq: 0, killerPuuid: ME_PUUID, weaponName: "Vandal" }),
    ]);
  });

  it("keeps omitted samples null instead of manufacturing zeroes", () => {
    const raw = rawMatch();
    raw.rounds[0]!.stats[0]!.economy = null as never;
    raw.rounds[0]!.stats[0]!.damage_events = null as never;
    const match = parse(raw);
    const row = toRoundPlayerRows(match).find((item) => item.puuid === ME_PUUID && item.round === 0);
    expect(row).toMatchObject({ weaponId: null, loadoutValue: null, damage: null, spent: null });
  });
});

describe("filters", () => {
  it("skips unfinished matches and those without the player", () => {
    const unfinished = parse(rawMatch({ isCompleted: false }));
    expect(isStorable(unfinished)).toBe(false);
    expect(includesPlayer(parse(rawMatch()), ME_PUUID)).toBe(true);
    expect(includesPlayer(parse(rawMatch()), "someone-else")).toBe(false);
  });
});

describe("toSnapshotRows", () => {
  it("maps RR history and drops entries without a match id", () => {
    const entries = [
      rawMmrEntry("m1", 12, -16, "2026-11-05T03:20:02.377Z"),
      { ...rawMmrEntry("m0", 28, 11, "2026-11-05T02:29:09.444Z"), match_id: null },
    ].map((e) => mmrHistoryEntrySchema.parse(e));
    expect(toSnapshotRows(ME_PUUID, entries)).toEqual([
      {
        puuid: ME_PUUID,
        tier: 21,
        tierName: "Ascendant 1",
        rr: 12,
        rrChange: -16,
        elo: 1812,
        matchId: "m1",
        recordedAt: new Date("2026-11-05T03:20:02.377Z"),
      },
    ]);
  });
});
