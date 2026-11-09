/**
 * Account deletion from Ajustes (SPEC §4 › Configurações). Always keyed by
 * the session's user id.
 *
 * One `db.batch` = one transaction (Neon HTTP has no interactive ones):
 * 1. each owned group goes to its heir (planOwnedGroups), guarded so a heir
 *    who left in the meantime is skipped; groups left without an heir go
 *    with the user (groups.owner_id cascades);
 * 2. the rank history and the Riot account link are removed, so nothing
 *    personal stays and the Riot ID can be linked again;
 * 3. the user row goes, cascading sessions, logins, memberships, goals,
 *    preferences, profile settings, nominations and votes.
 * Matches stay: they're shared with everyone who played them, and the
 * player shows on those scoreboards like anyone who doesn't use Retake.
 */
import "server-only";

import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { groupMembers, groups, mmrSnapshots, riotAccounts, users } from "@/db/schema";
import { accountDisplayName } from "@/lib/auth/display-name";

import { planOwnedGroups, type GroupFate, type OwnedGroup } from "./delete-plan";

/** What would happen to the groups `userId` owns, for the confirmation dialog. */
export async function getOwnedGroupFates(userId: string): Promise<GroupFate[]> {
  const owned = await db().select({ id: groups.id, name: groups.name }).from(groups).where(eq(groups.ownerId, userId)).orderBy(groups.name);
  if (owned.length === 0) return [];
  const members = await db()
    .select({
      groupId: groupMembers.groupId,
      userId: groupMembers.userId,
      joinedAt: groupMembers.joinedAt,
      providerName: users.name,
      gameName: riotAccounts.gameName,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(riotAccounts, eq(riotAccounts.userId, groupMembers.userId))
    .where(
      inArray(
        groupMembers.groupId,
        owned.map((g) => g.id),
      ),
    );
  const input: OwnedGroup[] = owned.map((g) => ({
    groupId: g.id,
    name: g.name,
    members: members
      .filter((m) => m.groupId === g.id)
      .map((m) => ({ userId: m.userId, name: accountDisplayName(m.providerName, m.gameName), joinedAt: m.joinedAt })),
  }));
  return planOwnedGroups(input, userId);
}

export async function deleteAccount(userId: string): Promise<void> {
  const fates = await getOwnedGroupFates(userId);
  const database = db();
  const transfers = fates.flatMap((fate) => {
    const heir = fate.heir;
    if (!heir) return [];
    return [
      database
        .update(groups)
        .set({ ownerId: heir.userId })
        .where(
          and(
            eq(groups.id, fate.groupId),
            eq(groups.ownerId, userId),
            sql`exists (select 1 from ${groupMembers} where ${groupMembers.groupId} = ${fate.groupId} and ${groupMembers.userId} = ${heir.userId})`,
          ),
        ),
      database
        .update(groupMembers)
        .set({ role: "owner" })
        .where(
          and(
            eq(groupMembers.groupId, fate.groupId),
            eq(groupMembers.userId, heir.userId),
            sql`(select ${groups.ownerId} from ${groups} where ${groups.id} = ${fate.groupId}) = ${heir.userId}`,
          ),
        ),
    ];
  });

  await database.batch([
    ...transfers,
    database
      .delete(mmrSnapshots)
      .where(inArray(mmrSnapshots.puuid, database.select({ puuid: riotAccounts.puuid }).from(riotAccounts).where(eq(riotAccounts.userId, userId)))),
    database.delete(riotAccounts).where(eq(riotAccounts.userId, userId)),
    database.delete(users).where(eq(users.id, userId)),
  ] as unknown as Parameters<typeof database.batch>[0]);
}
