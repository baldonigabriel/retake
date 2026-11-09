import "server-only";

import { eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { matchKills, matchRoundPlayers, matchRounds, matches } from "@/db/schema";

import type { KillSample, RoundContext, RoundPlayerSample } from "./metrics";

export interface RoundDataset {
  rounds: RoundContext[];
  players: RoundPlayerSample[];
  kills: KillSample[];
}

/** Raw round data for an already-authorized, already-filtered set of matches. */
export async function getRoundDataset(matchIds: readonly string[]): Promise<RoundDataset> {
  const ids = [...new Set(matchIds)];
  if (ids.length === 0) return { rounds: [], players: [], kills: [] };

  const [rounds, players, kills] = await Promise.all([
    db()
      .select({
        matchId: matchRounds.matchId,
        round: matchRounds.round,
        winningTeam: matchRounds.winningTeam,
        attackingTeam: matchRounds.attackingTeam,
        mapName: matches.mapName,
        mapId: matches.mapId,
        queueId: matches.queueId,
      })
      .from(matchRounds)
      .innerJoin(matches, eq(matches.id, matchRounds.matchId))
      .where(inArray(matchRounds.matchId, ids)),
    db()
      .select({
        matchId: matchRoundPlayers.matchId,
        round: matchRoundPlayers.round,
        puuid: matchRoundPlayers.puuid,
        team: matchRoundPlayers.team,
        weaponId: matchRoundPlayers.weaponId,
        weaponName: matchRoundPlayers.weaponName,
        loadoutValue: matchRoundPlayers.loadoutValue,
        damage: matchRoundPlayers.damage,
        score: matchRoundPlayers.score,
        headshots: matchRoundPlayers.headshots,
        bodyshots: matchRoundPlayers.bodyshots,
        legshots: matchRoundPlayers.legshots,
        kills: matchRoundPlayers.kills,
        assists: matchRoundPlayers.assists,
        survived: matchRoundPlayers.survived,
      })
      .from(matchRoundPlayers)
      .where(inArray(matchRoundPlayers.matchId, ids)),
    db()
      .select({
        matchId: matchKills.matchId,
        round: matchKills.round,
        seq: matchKills.seq,
        timeInRoundMs: matchKills.timeInRoundMs,
        killerPuuid: matchKills.killerPuuid,
        victimPuuid: matchKills.victimPuuid,
        assistants: matchKills.assistants,
        weaponId: matchKills.weaponId,
        weaponName: matchKills.weaponName,
        weaponType: matchKills.weaponType,
      })
      .from(matchKills)
      .where(inArray(matchKills.matchId, ids)),
  ]);
  return { rounds, players, kills };
}
