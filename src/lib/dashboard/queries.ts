/**
 * Reads for /me. Always keyed by the viewer's own puuid (resolved from the
 * session by the page), never by a puuid coming from the URL.
 */
import "server-only";

import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchPlayers, mmrSnapshots } from "@/db/schema";
import type { DashboardLine } from "@/lib/stats/breakdown";

/** Every stored match line for the player, newest first. */
export async function getPlayerLines(puuid: string): Promise<DashboardLine[]> {
  return db()
    .select({
      matchId: matches.id,
      startedAt: matches.startedAt,
      queueId: matches.queueId,
      mode: matches.mode,
      mapId: matches.mapId,
      mapName: matches.mapName,
      roundsPlayed: matches.roundsPlayed,
      winningTeam: matches.winningTeam,
      redScore: matches.redScore,
      blueScore: matches.blueScore,
      team: matchPlayers.team,
      agentId: matchPlayers.agentId,
      agentName: matchPlayers.agentName,
      won: matchPlayers.won,
      kills: matchPlayers.kills,
      deaths: matchPlayers.deaths,
      assists: matchPlayers.assists,
      score: matchPlayers.score,
      damageDealt: matchPlayers.damageDealt,
      headshots: matchPlayers.headshots,
      bodyshots: matchPlayers.bodyshots,
      legshots: matchPlayers.legshots,
    })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(eq(matchPlayers.puuid, puuid))
    .orderBy(desc(matches.startedAt));
}

export type RankPoint = { tier: number; tierName: string; rr: number; rrChange: number | null; elo: number | null; recordedAt: Date };

/** Competitive rank history, oldest → newest (last 50 updates). */
export async function getRankHistory(puuid: string): Promise<RankPoint[]> {
  const rows = await db()
    .select({
      tier: mmrSnapshots.tier,
      tierName: mmrSnapshots.tierName,
      rr: mmrSnapshots.rr,
      rrChange: mmrSnapshots.rrChange,
      elo: mmrSnapshots.elo,
      recordedAt: mmrSnapshots.recordedAt,
    })
    .from(mmrSnapshots)
    .where(eq(mmrSnapshots.puuid, puuid))
    .orderBy(desc(mmrSnapshots.recordedAt))
    .limit(50);
  return rows.reverse();
}

