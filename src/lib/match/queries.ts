/**
 * Reads for /match/[id].
 *
 * Privacy (CLAUDE.md): the page is only shown to users who played the
 * match. Other players appear only on this scoreboard: no links, no
 * profiles, no search.
 */
import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchPlayers } from "@/db/schema";

export type MatchDetail = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

async function loadMatch(matchId: string) {
  const [match] = await db().select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return null;
  const players = await db().select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
  return { match, players };
}

/** The match, if it exists AND `viewerPuuid` played in it; otherwise null. */
export async function getMatchForViewer(matchId: string, viewerPuuid: string): Promise<MatchDetail | null> {
  if (matchId.length === 0 || matchId.length > 100) return null;
  const detail = await loadMatch(matchId);
  if (!detail || !detail.players.some((p) => p.puuid === viewerPuuid)) return null;
  return detail;
}
