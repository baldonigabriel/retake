/** Pure Phase 9 metrics. Every percentage carries its explicit sample size. */

export interface RoundContext {
  matchId: string;
  round: number;
  winningTeam: string | null;
  attackingTeam: string | null;
  mapName: string | null;
  queueId: string;
}

export interface RoundPlayerSample {
  matchId: string;
  round: number;
  puuid: string;
  team: string;
  weaponId: string | null;
  weaponName: string | null;
  loadoutValue: number | null;
  damage: number | null;
  score: number | null;
  headshots: number | null;
  bodyshots: number | null;
  legshots: number | null;
  kills: number | null;
  assists: number | null;
  survived: boolean | null;
}

export interface KillSample {
  matchId: string;
  round: number;
  seq: number;
  timeInRoundMs: number;
  killerPuuid: string | null;
  victimPuuid: string;
  assistants: string[];
  weaponId: string | null;
  weaponName: string | null;
  weaponType: string | null;
}

export interface RateMetric {
  value: number | null;
  successes: number;
  sample: number;
}

export type ClutchByX = Record<1 | 2 | 3 | 4 | 5, { situations: number; wins: number; rate: number | null }>;

export interface EconomyMetric {
  band: "pistol" | "eco" | "force" | "full";
  wins: number;
  rounds: number;
  winRate: number | null;
  acs: number | null;
  acsSample: number;
}

export interface SideMetric {
  mapName: string;
  attack: RateMetric;
  defense: RateMetric;
}

export interface WeaponMetric {
  weaponId: string | null;
  weaponName: string;
  kills: number;
  headshots: number;
  shots: number;
  hsRate: number | null;
  shotSampleRounds: number;
  matches: number;
  prominent: boolean;
}

export interface PlayerRoundMetrics {
  rounds: number;
  firstBlood: RateMetric;
  firstDeath: RateMetric;
  multiKills: { three: number; four: number; ace: number };
  clutch: ClutchByX;
  kast: RateMetric;
  economy: EconomyMetric[];
  sides: SideMetric[];
  weapons: WeaponMetric[];
}

const keyOf = (matchId: string, round: number) => `${matchId}\u0000${round}`;
const rate = (successes: number, sample: number): RateMetric => ({
  value: sample > 0 ? successes / sample : null,
  successes,
  sample,
});

const ECONOMY_EXCLUDED = new Set(["deathmatch", "team_deathmatch", "teamdeathmatch"]);
export function supportsEconomy(queueId: string): boolean {
  return !ECONOMY_EXCLUDED.has(queueId.toLowerCase());
}

export function economyBand(round: number, averageLoadout: number): EconomyMetric["band"] {
  if (round === 0 || round === 12) return "pistol";
  if (averageLoadout < 2_000) return "eco";
  if (averageLoadout < 3_900) return "force";
  return "full";
}

function orderedKills(rows: readonly KillSample[]): KillSample[] {
  return [...rows].sort((a, b) => a.timeInRoundMs - b.timeInRoundMs || a.seq - b.seq);
}

function blankClutches(): ClutchByX {
  return {
    1: { situations: 0, wins: 0, rate: null },
    2: { situations: 0, wins: 0, rate: null },
    3: { situations: 0, wins: 0, rate: null },
    4: { situations: 0, wins: 0, rate: null },
    5: { situations: 0, wins: 0, rate: null },
  };
}

export function calculatePlayerRoundMetrics(input: {
  puuid: string;
  rounds: readonly RoundContext[];
  players: readonly RoundPlayerSample[];
  kills: readonly KillSample[];
}): PlayerRoundMetrics {
  const playerRounds = input.players.filter((row) => row.puuid === input.puuid);
  const contexts = new Map(input.rounds.map((round) => [keyOf(round.matchId, round.round), round]));
  const playersByRound = new Map<string, RoundPlayerSample[]>();
  for (const row of input.players) {
    const key = keyOf(row.matchId, row.round);
    const values = playersByRound.get(key) ?? [];
    values.push(row);
    playersByRound.set(key, values);
  }
  const killsByRound = new Map<string, KillSample[]>();
  for (const kill of input.kills) {
    const key = keyOf(kill.matchId, kill.round);
    const values = killsByRound.get(key) ?? [];
    values.push(kill);
    killsByRound.set(key, values);
  }

  let firstBloods = 0;
  let firstDeaths = 0;
  let openingSample = 0;
  let kastSuccesses = 0;
  let kastSample = 0;
  const multiKills = { three: 0, four: 0, ace: 0 };
  const clutch = blankClutches();
  const economy = new Map<EconomyMetric["band"], { wins: number; rounds: number; score: number; scoreSample: number }>();
  const sides = new Map<string, { attackWins: number; attack: number; defenseWins: number; defense: number }>();

  for (const playerRound of playerRounds) {
    const key = keyOf(playerRound.matchId, playerRound.round);
    const context = contexts.get(key);
    const roundPlayers = playersByRound.get(key) ?? [];
    const kills = orderedKills(killsByRound.get(key) ?? []);
    const openingKnown = playerRound.survived !== null;

    if (openingKnown) {
      openingSample++;
      const first = kills[0];
      if (first?.killerPuuid === input.puuid) firstBloods++;
      if (first?.victimPuuid === input.puuid) firstDeaths++;
    }

    const playerKills = kills.filter((kill) => kill.killerPuuid === input.puuid).length;
    if (playerKills === 3) multiKills.three++;
    else if (playerKills === 4) multiKills.four++;
    else if (playerKills >= 5) multiKills.ace++;

    if (playerRound.survived !== null) {
      kastSample++;
      const gotKill = playerKills > 0;
      const assisted = kills.some((kill) => kill.assistants.includes(input.puuid));
      const traded = kills.some((death) => {
        if (death.victimPuuid !== input.puuid || !death.killerPuuid) return false;
        return kills.some((trade) => {
          if (trade.timeInRoundMs < death.timeInRoundMs || trade.timeInRoundMs - death.timeInRoundMs > 5_000) {
            return false;
          }
          if (trade.victimPuuid !== death.killerPuuid || !trade.killerPuuid) return false;
          return roundPlayers.find((row) => row.puuid === trade.killerPuuid)?.team === playerRound.team;
        });
      });
      if (gotKill || assisted || playerRound.survived || traded) kastSuccesses++;
    }

    if (context && supportsEconomy(context.queueId)) {
      const teammates = roundPlayers.filter((row) => row.team === playerRound.team);
      const completeLoadout = teammates.length > 0 && teammates.every((row) => row.loadoutValue !== null);
      if (completeLoadout) {
        const average = teammates.reduce((sum, row) => sum + row.loadoutValue!, 0) / teammates.length;
        const band = economyBand(playerRound.round, average);
        const entry = economy.get(band) ?? { wins: 0, rounds: 0, score: 0, scoreSample: 0 };
        entry.rounds++;
        if (context.winningTeam === playerRound.team) entry.wins++;
        if (playerRound.score !== null) {
          entry.score += playerRound.score;
          entry.scoreSample++;
        }
        economy.set(band, entry);
      }

      const alive = new Map(roundPlayers.map((row) => [row.puuid, row.team]));
      let opportunity: number | null = null;
      for (const kill of kills) {
        alive.delete(kill.victimPuuid);
        if (opportunity !== null || !alive.has(input.puuid)) continue;
        const allies = [...alive.values()].filter((team) => team === playerRound.team).length;
        const opponents = [...alive.values()].filter((team) => team !== playerRound.team).length;
        if (allies === 1 && opponents >= 1 && opponents <= 5) opportunity = opponents;
      }
      if (opportunity !== null) {
        const x = opportunity as 1 | 2 | 3 | 4 | 5;
        clutch[x].situations++;
        if (context.winningTeam === playerRound.team) clutch[x].wins++;
      }
    }

    if (context?.attackingTeam && context.mapName) {
      const entry = sides.get(context.mapName) ?? { attackWins: 0, attack: 0, defenseWins: 0, defense: 0 };
      const won = context.winningTeam === playerRound.team;
      if (playerRound.team === context.attackingTeam) {
        entry.attack++;
        if (won) entry.attackWins++;
      } else {
        entry.defense++;
        if (won) entry.defenseWins++;
      }
      sides.set(context.mapName, entry);
    }
  }

  for (const value of Object.values(clutch)) value.rate = value.situations > 0 ? value.wins / value.situations : null;

  const weaponMap = new Map<
    string,
    { id: string | null; name: string; kills: number; headshots: number; shots: number; rounds: number; matches: Set<string> }
  >();
  for (const kill of input.kills.filter((row) => row.killerPuuid === input.puuid)) {
    const weaponKey = kill.weaponId ?? `name:${kill.weaponName ?? "Desconhecida"}`;
    const entry = weaponMap.get(weaponKey) ?? {
      id: kill.weaponId,
      name: kill.weaponName ?? "Desconhecida",
      kills: 0,
      headshots: 0,
      shots: 0,
      rounds: 0,
      matches: new Set<string>(),
    };
    entry.kills++;
    entry.matches.add(kill.matchId);
    weaponMap.set(weaponKey, entry);
  }
  for (const row of playerRounds) {
    if (!row.weaponId && !row.weaponName) continue;
    if (row.headshots === null || row.bodyshots === null || row.legshots === null) continue;
    const weaponKey = row.weaponId ?? `name:${row.weaponName}`;
    const entry = weaponMap.get(weaponKey) ?? {
      id: row.weaponId,
      name: row.weaponName ?? "Desconhecida",
      kills: 0,
      headshots: 0,
      shots: 0,
      rounds: 0,
      matches: new Set<string>(),
    };
    entry.headshots += row.headshots;
    entry.shots += row.headshots + row.bodyshots + row.legshots;
    entry.rounds++;
    entry.matches.add(row.matchId);
    weaponMap.set(weaponKey, entry);
  }

  return {
    rounds: playerRounds.length,
    firstBlood: rate(firstBloods, openingSample),
    firstDeath: rate(firstDeaths, openingSample),
    multiKills,
    clutch,
    kast: rate(kastSuccesses, kastSample),
    economy: (["pistol", "eco", "force", "full"] as const).flatMap((band) => {
      const entry = economy.get(band);
      return entry
        ? [
            {
              band,
              wins: entry.wins,
              rounds: entry.rounds,
              winRate: entry.rounds > 0 ? entry.wins / entry.rounds : null,
              acs: entry.scoreSample > 0 ? entry.score / entry.scoreSample : null,
              acsSample: entry.scoreSample,
            },
          ]
        : [];
    }),
    sides: [...sides.entries()]
      .map(([mapName, entry]) => ({
        mapName,
        attack: rate(entry.attackWins, entry.attack),
        defense: rate(entry.defenseWins, entry.defense),
      }))
      .sort((a, b) => a.mapName.localeCompare(b.mapName, "pt-BR")),
    weapons: [...weaponMap.values()]
      .map((entry) => ({
        weaponId: entry.id,
        weaponName: entry.name,
        kills: entry.kills,
        headshots: entry.headshots,
        shots: entry.shots,
        hsRate: entry.shots > 0 ? entry.headshots / entry.shots : null,
        shotSampleRounds: entry.rounds,
        matches: entry.matches.size,
        prominent: entry.kills >= 10 || entry.shots >= 100,
      }))
      .sort((a, b) => b.kills - a.kills || b.shots - a.shots || a.weaponName.localeCompare(b.weaponName, "pt-BR")),
  };
}
