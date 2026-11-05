/**
 * Reads for the group screens.
 *
 * Access rules (CLAUDE.md › Privacidade):
 * - Every group read starts from the viewer's own membership
 *   (`getMembership`): a non-member gets null, exactly like a slug that
 *   doesn't exist, so pages answer 404 without revealing the group exists.
 * - Stats are loaded only for the members' own puuids. Players who aren't
 *   users never get a row here: no profile, no search, no list.
 * - An invite token is the only way to see a group's name without being in it.
 */
import "server-only";

import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import { db } from "@/db";
import { groupMembers, groups, matches, matchPlayers, riotAccounts, users, type Group, type GroupRole } from "@/db/schema";
import type { GroupLine, GroupMember } from "@/lib/groups/ranking";

import { inviteCodeSchema, slugSchema } from "./validation";

const memberCount = sql<number>`(select count(*)::int from ${groupMembers} where ${groupMembers.groupId} = ${groups.id})`;

export type GroupSummary = { id: string; name: string; slug: string; role: GroupRole; members: number };

/** The viewer's groups, by name. */
export async function listGroupsForUser(userId: string): Promise<GroupSummary[]> {
  return db()
    .select({ id: groups.id, name: groups.name, slug: groups.slug, role: groupMembers.role, members: memberCount })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(eq(groupMembers.userId, userId))
    .orderBy(asc(groups.name));
}

export type Membership = { group: Group; role: GroupRole };

/** The group behind `slug` **only if** `userId` is a member; otherwise null. */
export const getMembership = cache(async (slug: string, userId: string): Promise<Membership | null> => {
  const parsed = slugSchema.safeParse(slug);
  if (!parsed.success) return null;
  const [row] = await db()
    .select({ group: groups, role: groupMembers.role })
    .from(groups)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, groups.id), eq(groupMembers.userId, userId)))
    .where(eq(groups.slug, parsed.data))
    .limit(1);
  return row ?? null;
});

/** Role of `userId` in `groupId`, or null when not a member. For Server Actions. */
export async function getRole(groupId: string, userId: string): Promise<GroupRole | null> {
  const [row] = await db()
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

export type MemberRow = GroupMember & { joinedAt: Date };

/** Members of a group the caller already proved membership of (getMembership). */
export async function getGroupMembers(groupId: string, viewerId: string): Promise<MemberRow[]> {
  const rows = await db()
    .select({
      userId: users.id,
      discordName: users.name,
      image: users.image,
      role: groupMembers.role,
      joinedAt: groupMembers.joinedAt,
      puuid: riotAccounts.puuid,
      gameName: riotAccounts.gameName,
      tagLine: riotAccounts.tagLine,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(riotAccounts, eq(riotAccounts.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt));
  return rows.map((r) => ({
    userId: r.userId,
    puuid: r.puuid,
    name: r.gameName ?? r.discordName,
    tag: r.tagLine,
    image: r.image,
    role: r.role,
    isYou: r.userId === viewerId,
    joinedAt: r.joinedAt,
  }));
}

const lineColumns = {
  puuid: matchPlayers.puuid,
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
};

/** Members' match lines in [since, until). Only these puuids, never other players. */
export async function getMemberLines(puuids: readonly string[], since: Date, until: Date): Promise<GroupLine[]> {
  if (puuids.length === 0) return [];
  return db()
    .select(lineColumns)
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(and(inArray(matchPlayers.puuid, [...puuids]), gte(matches.startedAt, since), lt(matches.startedAt, until)))
    .orderBy(desc(matches.startedAt));
}

/** Lines of the newest `limit` (match, team) pairs where 2+ of these puuids played together. */
export async function getTogetherLines(puuids: readonly string[], limit = 10): Promise<GroupLine[]> {
  if (puuids.length < 2) return [];
  const list = [...puuids];
  const pairs = db()
    .select({ matchId: matchPlayers.matchId, team: matchPlayers.team })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(inArray(matchPlayers.puuid, list))
    .groupBy(matchPlayers.matchId, matchPlayers.team, matches.startedAt)
    .having(sql`count(*) >= 2`)
    .orderBy(desc(matches.startedAt))
    .limit(limit)
    .as("pairs");
  return db()
    .select(lineColumns)
    .from(matchPlayers)
    .innerJoin(pairs, and(eq(pairs.matchId, matchPlayers.matchId), eq(pairs.team, matchPlayers.team)))
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(inArray(matchPlayers.puuid, list))
    .orderBy(desc(matches.startedAt));
}

export type InvitePreview = { id: string; name: string; slug: string; members: number };

/** What an invite link reveals: the group's name and size. Null for a bad or revoked token. */
export async function getInvite(code: string): Promise<InvitePreview | null> {
  if (!inviteCodeSchema.safeParse(code).success) return null;
  const [row] = await db()
    .select({ id: groups.id, name: groups.name, slug: groups.slug, members: memberCount })
    .from(groups)
    .where(eq(groups.inviteCode, code))
    .limit(1);
  return row ?? null;
}

/** puuids of everyone who shares at least one group with `userId` (for the "grupo" badge). */
export async function getGroupMatePuuids(userId: string): Promise<Set<string>> {
  const mine = alias(groupMembers, "mine");
  const rows = await db()
    .selectDistinct({ puuid: riotAccounts.puuid })
    .from(mine)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, mine.groupId), ne(groupMembers.userId, userId)))
    .innerJoin(riotAccounts, eq(riotAccounts.userId, groupMembers.userId))
    .where(eq(mine.userId, userId));
  return new Set(rows.map((r) => r.puuid));
}
