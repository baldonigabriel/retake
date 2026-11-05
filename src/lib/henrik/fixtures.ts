/**
 * Synthetic HenrikDev v4 payloads for tests. Shaped like real responses
 * (including fields we don't read, to prove they're ignored) but with
 * made-up players: real third-party names never go into the repo.
 */

export const ME_PUUID = "00000000-0000-4000-8000-000000000001";

export interface RawPlayerOverrides {
  puuid?: string;
  team?: string;
  kills?: number;
  deaths?: number;
  score?: number;
}

export function rawPlayer(index: number, overrides: RawPlayerOverrides = {}) {
  const puuid = overrides.puuid ?? `00000000-0000-4000-8000-0000000001${String(index).padStart(2, "0")}`;
  return {
    puuid,
    name: index === 0 ? "Tester" : `Player ${index}`,
    tag: "TST",
    team_id: overrides.team ?? (index < 5 ? "Blue" : "Red"),
    team_number: 1,
    platform: "pc",
    party_id: "party-1",
    agent: { id: "569fdd95-4d10-43ab-ca70-79becc718b46", name: "Sage" },
    stats: {
      score: overrides.score ?? 4000 + index,
      kills: overrides.kills ?? 15,
      deaths: overrides.deaths ?? 12,
      assists: 4,
      headshots: 10,
      bodyshots: 40,
      legshots: 2,
      damage: { dealt: 2900, received: 2600 },
    },
    // Fields below are not read by our schema.
    performance: { score: 55.1, ratings: { grade: "pass" } },
    ability_casts: { grenade: 10, ability1: 3, ability2: 5, ultimate: 1 },
    tier: { id: 21, name: "Ascendant 1" },
    customization: { card: "card-id", title: "title-id" },
    account_level: 200,
    economy: { spent: { overall: 40000, average: 2000 } },
  };
}

export interface RawMatchOverrides {
  matchId?: string;
  queueId?: string;
  startedAt?: string;
  blueRounds?: number;
  redRounds?: number;
  isCompleted?: boolean;
}

export function rawMatch(overrides: RawMatchOverrides = {}) {
  const blue = overrides.blueRounds ?? 13;
  const red = overrides.redRounds ?? 7;
  const players = Array.from({ length: 10 }, (_, i) => rawPlayer(i, i === 0 ? { puuid: ME_PUUID } : {}));
  return {
    metadata: {
      match_id: overrides.matchId ?? "11111111-1111-4111-8111-111111111111",
      map: { id: "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319", name: "Ascent" },
      game_version: "release-13.09",
      game_length_in_ms: 2_100_000,
      started_at: overrides.startedAt ?? "2026-11-05T03:20:02.377Z",
      is_completed: overrides.isCompleted ?? true,
      queue: { id: overrides.queueId ?? "competitive", name: "Competitive", mode_type: "Standard" },
      season: { id: "d816f426-48ea-f052-117f-9697a155b319", short: "e11a6" },
      platform: "pc",
      premier: null,
      region: "na",
      cluster: "Sao Paulo",
      some_future_field: { nested: true },
    },
    players,
    observers: [],
    coaches: [],
    teams: [
      { team_id: "Blue", placement: 1, rounds: { won: blue, lost: red }, won: blue > red, premier_roster: null },
      { team_id: "Red", placement: 2, rounds: { won: red, lost: blue }, won: red > blue, premier_roster: null },
    ],
    rounds: Array.from({ length: blue + red }, (_, i) => ({ id: i, result: "Elimination" })),
    kills: [],
  };
}

export function rawMmrEntry(matchId: string, rr: number, lastChange: number, date: string) {
  return {
    tier: { id: 21, name: "Ascendant 1" },
    match_id: matchId,
    map: { id: "x", name: "Ascent" },
    season: { id: "s", short: "e11a6" },
    rr,
    last_change: lastChange,
    elo: 1800 + rr,
    refunded_rr: 0,
    date,
    queue_id: "competitive",
    is_placement_match: false,
  };
}
