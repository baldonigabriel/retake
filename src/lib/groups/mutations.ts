/**
 * Group writes. Every function re-checks the caller's role in the database;
 * nothing trusts a role or membership sent by the client.
 *
 * Roles: the owner manages the invite link, the webhook and the members;
 * members can only leave. When the owner leaves, the longest-standing member
 * becomes the owner; when the last member leaves, the group is deleted.
 *
 * Neon's HTTP driver has no interactive transactions, so multi-statement
 * writes go through db.batch (one transaction).
 */
import "server-only";

import { randomUUID } from "node:crypto";

import { and, asc, eq, ne } from "drizzle-orm";

import type { Database } from "@/db";
import { groupMembers, groups } from "@/db/schema";
import { encrypt, serverKey } from "@/lib/crypto";

import { newInviteCode } from "./invite";
import { getInvite, getRole } from "./queries";
import { MAX_MEMBERS } from "./validation";

export type GroupErrorCode = "slug_taken" | "invalid_invite" | "full" | "not_found" | "forbidden" | "self";

export class GroupError extends Error {
  constructor(readonly code: GroupErrorCode) {
    super(code);
  }
}

function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

async function assertOwner(groupId: string, userId: string) {
  const role = await getRole(groupId, userId);
  if (role === null) throw new GroupError("not_found");
  if (role !== "owner") throw new GroupError("forbidden");
}

/** Creates the group with the caller as owner. Returns the slug. */
export async function createGroup(database: Database, ownerId: string, input: { name: string; slug: string }): Promise<string> {
  const id = randomUUID();
  try {
    await database.batch([
      database.insert(groups).values({ id, name: input.name, slug: input.slug, ownerId, inviteCode: newInviteCode() }),
      database.insert(groupMembers).values({ groupId: id, userId: ownerId, role: "owner" }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw new GroupError("slug_taken");
    throw error;
  }
  return input.slug;
}

/** Joins through an invite token. Already a member → no-op. Returns the slug. */
export async function joinGroup(database: Database, userId: string, code: string): Promise<string> {
  const invite = await getInvite(code);
  if (!invite) throw new GroupError("invalid_invite");
  if ((await getRole(invite.id, userId)) !== null) return invite.slug;
  if (invite.members >= MAX_MEMBERS) throw new GroupError("full");
  await database.insert(groupMembers).values({ groupId: invite.id, userId, role: "member" }).onConflictDoNothing();
  return invite.slug;
}

/** Leaves the group. Returns whether the group was deleted (last member out). */
export async function leaveGroup(database: Database, userId: string, groupId: string): Promise<{ deleted: boolean }> {
  const role = await getRole(groupId, userId);
  if (role === null) throw new GroupError("not_found");

  const leave = database.delete(groupMembers).where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)));
  if (role === "member") {
    await leave;
    return { deleted: false };
  }

  const [heir] = await database
    .select({ userId: groupMembers.userId })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), ne(groupMembers.userId, userId)))
    .orderBy(asc(groupMembers.joinedAt))
    .limit(1);
  if (!heir) {
    await database.delete(groups).where(eq(groups.id, groupId));
    return { deleted: true };
  }
  await database.batch([
    database
      .update(groupMembers)
      .set({ role: "owner" })
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, heir.userId))),
    database.update(groups).set({ ownerId: heir.userId }).where(eq(groups.id, groupId)),
    leave,
  ]);
  return { deleted: false };
}

/** Owner removes someone else. */
export async function removeMember(database: Database, ownerId: string, groupId: string, targetUserId: string): Promise<void> {
  await assertOwner(groupId, ownerId);
  if (targetUserId === ownerId) throw new GroupError("self");
  await database
    .delete(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, targetUserId), eq(groupMembers.role, "member")));
}

/** Owner replaces the invite token: the old link stops working immediately. */
export async function revokeInvite(database: Database, ownerId: string, groupId: string): Promise<void> {
  await assertOwner(groupId, ownerId);
  await database.update(groups).set({ inviteCode: newInviteCode() }).where(eq(groups.id, groupId));
}

/** Owner saves (encrypted, bound to this group) or clears the Discord webhook. */
export async function setWebhook(database: Database, ownerId: string, groupId: string, url: string | null): Promise<void> {
  await assertOwner(groupId, ownerId);
  const value = url === null ? null : encrypt(url, serverKey(), webhookContext(groupId));
  await database.update(groups).set({ discordWebhookUrl: value }).where(eq(groups.id, groupId));
}

/** Additional authenticated data: a ciphertext copied to another group won't decrypt. */
export function webhookContext(groupId: string): string {
  return `group-webhook:${groupId}`;
}
