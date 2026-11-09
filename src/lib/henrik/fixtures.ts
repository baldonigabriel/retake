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
    rounds: Array.from({ length: blue + red }, (_, i) => ({
      id: i,
      result: "Elimination",
      winning_team: i < blue ? "Blue" : "Red",
      winning_team_role: i % 2 === 0 ? "Attack" : "Defense",
      stats: players.map((player, playerIndex) => ({
        player: { puuid: player.puuid, name: player.name, tag: player.tag, team: player.team_id },
        damage_events: [
          { player: { puuid: "target", name: "Target", tag: "TST", team: player.team_id }, damage: 100, headshots: 1, bodyshots: 2, legshots: 0 },
        ],
        stats: { score: 200, kills: playerIndex === 0 ? 1 : 0, headshots: 1, bodyshots: 2, legshots: 0 },
        economy: {
          loadout_value: i === 0 || i === 12 ? 800 : 4_100,
          remaining: 900,
          weapon: { id: "weapon-vandal", name: "Vandal", type: "Rifle" },
          armor: { id: "armor-heavy", name: "Heavy Shields" },
        },
        was_afk: false,
        received_penalty: false,
        stayed_in_spawn: false,
      })),
    })),
    kills: [
      {
        round: 0,
        time_in_round_in_ms: 12_000,
        time_in_match_in_ms: 12_000,
        killer: { puuid: ME_PUUID, name: "Tester", tag: "TST", team: "Blue" },
        victim: { puuid: players[5]!.puuid, name: players[5]!.name, tag: "TST", team: "Red" },
        assistants: [],
        weapon: { id: "weapon-vandal", name: "Vandal", type: "Rifle" },
        secondary_fire_mode: false,
        location: { x: 0, y: 0 },
        player_locations: [],
      },
    ],
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
