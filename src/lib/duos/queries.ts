/**
 * Reads for "Com quem você joga melhor".
 *
 * Privacy (CLAUDE.md › Privacidade): a mate is a Retake user with a linked
 * Riot account who shares at least one group with the viewer (or, scoped,
 * this one group). Players who aren't users never come out of here: the
 * appearances query only takes those mates' puuids.
 */
import "server-only";

import { and, eq, inArray, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import { db } from "@/db";
import { groupMembers, matchPlayers, riotAccounts, users } from "@/db/schema";
import type { MateAppearance } from "@/lib/stats/synergy";

export type Mate = { userId: string; puuid: string; name: string; tag: string; image: string | null };

/**
 * Retake users with a Riot account who share a group with `viewerId`.
 * With `groupId`, only that group's members (the caller already proved the
 * viewer is in it).
 */
export async function getMates(viewerId: string, groupId?: string): Promise<Mate[]> {
  const mine = alias(groupMembers, "mine");
  const rows = await db()
    .selectDistinct({
      userId: users.id,
      puuid: riotAccounts.puuid,
      gameName: riotAccounts.gameName,
      tagLine: riotAccounts.tagLine,
      image: users.image,
    })
    .from(mine)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, mine.groupId), ne(groupMembers.userId, viewerId)))
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .innerJoin(riotAccounts, eq(riotAccounts.userId, users.id))
    .where(groupId ? and(eq(mine.userId, viewerId), eq(mine.groupId, groupId)) : eq(mine.userId, viewerId));
  return rows.map((r) => ({ userId: r.userId, puuid: r.puuid, name: r.gameName, tag: r.tagLine, image: r.image }));
}

/**
 * Where each mate (same scope as getMates) shared a team with the viewer:
 * puuid → [(match, team)]. One query, so it runs in parallel with getMates.
 */
export async function getMateAppearances(
  viewerId: string,
  viewerPuuid: string,
  groupId?: string,
): Promise<Map<string, MateAppearance[]>> {
  const mine = alias(groupMembers, "mine");
  const me = alias(matchPlayers, "me");
  const matePuuids = db()
    .selectDistinct({ puuid: riotAccounts.puuid })
    .from(mine)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, mine.groupId), ne(groupMembers.userId, viewerId)))
    .innerJoin(riotAccounts, eq(riotAccounts.userId, groupMembers.userId))
    .where(groupId ? and(eq(mine.userId, viewerId), eq(mine.groupId, groupId)) : eq(mine.userId, viewerId));
  const rows = await db()
    .select({ puuid: matchPlayers.puuid, matchId: matchPlayers.matchId, team: matchPlayers.team })
    .from(matchPlayers)
    .innerJoin(me, and(eq(me.matchId, matchPlayers.matchId), eq(me.puuid, viewerPuuid), eq(me.team, matchPlayers.team)))
    .where(inArray(matchPlayers.puuid, matePuuids));
  const result = new Map<string, MateAppearance[]>();
  for (const r of rows) {
    const list = result.get(r.puuid) ?? [];
    list.push({ matchId: r.matchId, team: r.team });
    result.set(r.puuid, list);
  }
  return result;
}
