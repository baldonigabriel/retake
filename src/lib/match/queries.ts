/**
 * Reads for /match/[id].
 *
 * Privacy (CLAUDE.md): the page is only shown to users who played the
 * match. Players who aren't Retake users appear only on this scoreboard: no
 * links, no profiles, no search. Users link to their member profile (group
 * mates) or their opt-in public profile (src/lib/profile/links.ts).
 */
import "server-only";

import { and, eq, inArray, isNotNull } from "drizzle-orm";

import { db } from "@/db";
import { matches, matchPlayers, mmrSnapshots, riotAccounts } from "@/db/schema";

export type MatchDetail = NonNullable<Awaited<ReturnType<typeof loadMatch>>>;

async function loadMatch(matchId: string) {
  const [match] = await db().select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return null;
  const players = await db().select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
  return { match, players };
}

/**
 * The match and its players, unchecked: the page decides who may see it
 * (src/lib/match/access.ts) and answers 404 otherwise.
 */
export async function getMatch(matchId: string): Promise<MatchDetail | null> {
  if (matchId.length === 0 || matchId.length > 100) return null;
  return loadMatch(matchId);
}

/**
 * RR won or lost in this match, only for players who are Retake users (a
 * riot account linked to a user). Users without a snapshot for the match map
 * to null ("—"); players who aren't users are absent from the map entirely,
 * so the page shows nothing for them.
 */
export async function getMatchRrForUsers(matchId: string, puuids: readonly string[]): Promise<Map<string, number | null>> {
  if (puuids.length === 0) return new Map();
  const rows = await db()
    .select({ puuid: riotAccounts.puuid, rrChange: mmrSnapshots.rrChange })
    .from(riotAccounts)
    .leftJoin(mmrSnapshots, and(eq(mmrSnapshots.puuid, riotAccounts.puuid), eq(mmrSnapshots.matchId, matchId)))
    .where(and(inArray(riotAccounts.puuid, [...puuids]), isNotNull(riotAccounts.userId)));
  return new Map(rows.map((r) => [r.puuid, r.rrChange ?? null]));
}
