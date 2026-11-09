/**
 * Reads and writes for public profiles (SPEC §6).
 *
 * Privacy: every read that can reach a visitor goes through
 * `isProfileVisible`, and every "no" looks the same (null / not in the map /
 * not in the results), whether the player is private, not a Retake user or
 * doesn't exist. Only riot_accounts rows owned by a user are ever read here,
 * so players who only appear in someone's match never surface.
 */
import "server-only";

import { and, desc, eq, inArray, isNotNull, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { cache } from "react";

import { db } from "@/db";
import { foldName as foldColumn, groupMembers, groups, mmrSnapshots, profileSettings, riotAccounts } from "@/db/schema";

import { profilePath, type RiotIdParts } from "./path";
import { SEARCH_LIMIT, escapeLike, rankResults, type SearchQuery } from "./search";
import {
  DEFAULT_PROFILE_SETTINGS,
  isProfileVisible,
  settingsFromChoice,
  type ProfileChoice,
  type ProfileSettings,
} from "./settings";

const settingsColumns = {
  isPublic: profileSettings.isPublic,
  showRank: profileSettings.showRank,
  showOverview: profileSettings.showOverview,
  showAgents: profileSettings.showAgents,
  showMaps: profileSettings.showMaps,
  showMatches: profileSettings.showMatches,
  showWeapons: profileSettings.showWeapons,
  decidedAt: profileSettings.decidedAt,
};

/** The user's own settings (no row = private, never asked). */
export const getProfileSettings = cache(async (userId: string): Promise<ProfileSettings> => {
  const [row] = await db().select(settingsColumns).from(profileSettings).where(eq(profileSettings.userId, userId)).limit(1);
  return row ?? DEFAULT_PROFILE_SETTINGS;
});

/** Saves the answer; takes effect at once (pages read it on every request). */
export async function saveProfileChoice(userId: string, choice: ProfileChoice): Promise<ProfileSettings> {
  const now = new Date();
  const values = { ...settingsFromChoice(choice), decidedAt: now, updatedAt: now };
  const [row] = await db()
    .insert(profileSettings)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: profileSettings.userId, set: values })
    .returning(settingsColumns);
  return row!;
}

export type PublicProfile = {
  userId: string;
  puuid: string;
  gameName: string;
  tagLine: string;
  cardUrl: string | null;
  settings: ProfileSettings;
};

/**
 * The profile behind `/u/Nome-TAG`, by the CURRENT Riot ID (case-insensitive),
 * or null — for a private profile, a player who isn't a user and a name that
 * doesn't exist alike.
 */
export const findPublicProfile = cache(async ({ gameName, tagLine }: RiotIdParts): Promise<PublicProfile | null> => {
  const rows = await db()
    .select({
      userId: riotAccounts.userId,
      puuid: riotAccounts.puuid,
      gameName: riotAccounts.gameName,
      tagLine: riotAccounts.tagLine,
      cardUrl: riotAccounts.cardUrl,
      ...settingsColumns,
    })
    .from(riotAccounts)
    .innerJoin(profileSettings, eq(profileSettings.userId, riotAccounts.userId))
    .where(
      and(
        isNotNull(riotAccounts.userId),
        eq(profileSettings.isPublic, true),
        sql`${foldColumn(riotAccounts.gameName)} = retake_fold(${gameName})`,
        sql`lower(${riotAccounts.tagLine}) = lower(${tagLine})`,
      ),
    )
    .limit(2);
  // Riot IDs are unique; two hits would mean stale names in our table. Answer "not found" rather than guess.
  if (rows.length !== 1) return null;
  const { userId, puuid, cardUrl, ...rest } = rows[0]!;
  const settings: ProfileSettings = {
    isPublic: rest.isPublic,
    showRank: rest.showRank,
    showOverview: rest.showOverview,
    showAgents: rest.showAgents,
    showMaps: rest.showMaps,
    showMatches: rest.showMatches,
    showWeapons: rest.showWeapons,
    decidedAt: rest.decidedAt,
  };
  if (!userId || !isProfileVisible(settings)) return null;
  return { userId, puuid, gameName: rest.gameName, tagLine: rest.tagLine, cardUrl, settings };
});

export type SearchResult = {
  path: string;
  gameName: string;
  tagLine: string;
  cardUrl: string | null;
  /** Latest known tier, only when the profile shows its rank. */
  tier: number | null;
};

/** Up to 10 public profiles whose Riot name contains the query (SPEC §6.4). */
export async function searchPublicProfiles(query: Extract<SearchQuery, { kind: "ok" }>): Promise<SearchResult[]> {
  const rows = await db()
    .select({
      puuid: riotAccounts.puuid,
      gameName: riotAccounts.gameName,
      tagLine: riotAccounts.tagLine,
      cardUrl: riotAccounts.cardUrl,
      ...settingsColumns,
    })
    .from(profileSettings)
    .innerJoin(riotAccounts, eq(riotAccounts.userId, profileSettings.userId))
    .where(
      and(
        eq(profileSettings.isPublic, true),
        sql`${foldColumn(riotAccounts.gameName)} like ${`%${escapeLike(query.name)}%`} escape '\\'`,
        query.tag ? sql`${foldColumn(riotAccounts.tagLine)} like ${`${escapeLike(query.tag)}%`} escape '\\'` : undefined,
      ),
    )
    .limit(SEARCH_LIMIT * 5);

  const visible = rankResults(
    rows.filter((r) => isProfileVisible(r)),
    query.name,
  ).slice(0, SEARCH_LIMIT);
  const tiers = await latestTiers(visible.filter((r) => r.showRank).map((r) => r.puuid));
  return visible.map((r) => ({
    path: profilePath(r),
    gameName: r.gameName,
    tagLine: r.tagLine,
    cardUrl: r.cardUrl,
    tier: r.showRank ? (tiers.get(r.puuid) ?? null) : null,
  }));
}

async function latestTiers(puuids: readonly string[]): Promise<Map<string, number>> {
  if (puuids.length === 0) return new Map();
  const rows = await db()
    .selectDistinctOn([mmrSnapshots.puuid], { puuid: mmrSnapshots.puuid, tier: mmrSnapshots.tier })
    .from(mmrSnapshots)
    .where(inArray(mmrSnapshots.puuid, [...puuids]))
    .orderBy(mmrSnapshots.puuid, desc(mmrSnapshots.recordedAt));
  return new Map(rows.map((r) => [r.puuid, r.tier]));
}

/** puuid → `/u/...` for the players in `puuids` whose profile is visible to everyone. */
export async function getPublicProfilePaths(puuids: readonly string[]): Promise<Map<string, string>> {
  if (puuids.length === 0) return new Map();
  const rows = await db()
    .select({ puuid: riotAccounts.puuid, gameName: riotAccounts.gameName, tagLine: riotAccounts.tagLine, ...settingsColumns })
    .from(riotAccounts)
    .innerJoin(profileSettings, eq(profileSettings.userId, riotAccounts.userId))
    .where(and(inArray(riotAccounts.puuid, [...puuids]), eq(profileSettings.isPublic, true)));
  return new Map(rows.filter((r) => isProfileVisible(r)).map((r) => [r.puuid, profilePath(r)]));
}

/**
 * puuid → member profile path for everyone who shares a group with
 * `userId` (the first shared group by name, so the link is stable).
 */
export async function getMateProfilePaths(userId: string): Promise<Map<string, string>> {
  const mine = alias(groupMembers, "mine");
  const rows = await db()
    .select({ puuid: riotAccounts.puuid, userId: groupMembers.userId, slug: groups.slug })
    .from(mine)
    .innerJoin(groupMembers, and(eq(groupMembers.groupId, mine.groupId), ne(groupMembers.userId, userId)))
    .innerJoin(groups, eq(groups.id, mine.groupId))
    .innerJoin(riotAccounts, eq(riotAccounts.userId, groupMembers.userId))
    .where(eq(mine.userId, userId))
    .orderBy(groups.name, groups.slug);
  const paths = new Map<string, string>();
  for (const r of rows) {
    if (!paths.has(r.puuid)) paths.set(r.puuid, `/groups/${r.slug}/members/${encodeURIComponent(r.userId)}`);
  }
  return paths;
}
