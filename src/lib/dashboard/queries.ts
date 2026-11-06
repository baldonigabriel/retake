/**
 * Reads for /me. Always keyed by the viewer's own puuid (resolved from the
 * session by the page), never by a puuid coming from the URL.
 */
import "server-only";

import { and, desc, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchPlayers, mmrSnapshots } from "@/db/schema";
import type { DetailedLine } from "@/lib/stats/breakdown";

/** Every stored match line for the player, newest first. */
export async function getPlayerLines(puuid: string): Promise<DetailedLine[]> {
  return db()
    .select({
      matchId: matches.id,
      startedAt: matches.startedAt,
      queueId: matches.queueId,
      mode: matches.mode,
      seasonId: matches.seasonId,
      gameLengthMs: matches.gameLengthMs,
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
      damageReceived: matchPlayers.damageReceived,
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


export interface MatchExtras {
  /** Competitive tier the player had in that match (match_players.tier) */
  tier: number | null;
  /** 1 = best ACS of the player's team (ties share the position) */
  teamPosition: number;
  teamSize: number;
  /** RR won or lost, from the snapshot linked to the match; null when there's none */
  rrChange: number | null;
}

/**
 * Per-match extras for the rows on screen: tier, place in the team by ACS
 * (score / rounds; same rounds for the whole team, so ranking by score is
 * the same) and RR. Only for `puuid`'s own lines.
 */
export async function getMatchExtras(puuid: string, matchIds: readonly string[]): Promise<Map<string, MatchExtras>> {
  if (matchIds.length === 0) return new Map();
  const ids = [...matchIds];
  const ranked = db()
    .select({
      matchId: matchPlayers.matchId,
      puuid: matchPlayers.puuid,
      tier: matchPlayers.tier,
      position: sql<number>`rank() over (partition by ${matchPlayers.matchId}, ${matchPlayers.team} order by ${matchPlayers.score} desc)`.as("position"),
      size: sql<number>`count(*) over (partition by ${matchPlayers.matchId}, ${matchPlayers.team})`.as("size"),
    })
    .from(matchPlayers)
    .where(inArray(matchPlayers.matchId, ids))
    .as("ranked");
  const rows = await db()
    .select({
      matchId: ranked.matchId,
      tier: ranked.tier,
      position: ranked.position,
      size: ranked.size,
      rrChange: mmrSnapshots.rrChange,
    })
    .from(ranked)
    .leftJoin(mmrSnapshots, and(eq(mmrSnapshots.puuid, ranked.puuid), eq(mmrSnapshots.matchId, ranked.matchId)))
    .where(eq(ranked.puuid, puuid));
  return new Map(
    rows.map((r) => [
      r.matchId,
      { tier: r.tier, teamPosition: Number(r.position), teamSize: Number(r.size), rrChange: r.rrChange ?? null },
    ]),
  );
}
