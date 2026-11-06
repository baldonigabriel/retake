/**
 * Bagre writes (docs/SPEC.md §5.5). Every function re-checks, in the
 * database, who the caller is in the group the row belongs to; nothing
 * trusts a group id, role or membership sent by the client. The group is
 * always read from the round (or the nomination's round), never from input.
 *
 * Framework-free (no "server-only" here) so the e2e suite can call the same
 * functions the Server Actions call; the actions file is the server boundary.
 */
import { and, eq, gte, lt, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { awardNominations, awardRounds, awardVotes, groupMembers, groups, matches, matchPlayers, riotAccounts, type AwardRound, type GroupRole } from "@/db/schema";

import { BagreError } from "./errors";
import { isAccepting } from "./rounds";
import type { BagreSettingsInput, NominateInput } from "./validation";

function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}

/** Role of `userId` in `groupId`, or null when not a member. */
async function roleIn(database: Database, groupId: string, userId: string): Promise<GroupRole | null> {
  const [row] = await database
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.userId, userId)))
    .limit(1);
  return row?.role ?? null;
}

/** Owner turns the Bagre on/off and picks the cadence (applies from the next period on). */
export async function updateBagreSettings(database: Database, userId: string, input: BagreSettingsInput): Promise<void> {
  const role = await roleIn(database, input.groupId, userId);
  if (role === null) throw new BagreError("not_found");
  if (role !== "owner") throw new BagreError("forbidden");
  await database
    .update(groups)
    .set({ bagreEnabled: input.enabled, bagreCadence: input.cadence })
    .where(eq(groups.id, input.groupId));
}

/**
 * The round, if the caller is a member of its group and the period still
 * takes nominations/votes. Order matters: membership first, so an outsider
 * only ever learns "not_found".
 */
async function roundForMember(database: Database, roundId: string, userId: string, now: Date): Promise<AwardRound> {
  const [row] = await database
    .select({ round: awardRounds, enabled: groups.bagreEnabled })
    .from(awardRounds)
    .innerJoin(groups, eq(groups.id, awardRounds.groupId))
    .where(eq(awardRounds.id, roundId))
    .limit(1);
  if (!row || (await roleIn(database, row.round.groupId, userId)) === null) throw new BagreError("not_found");
  if (!row.enabled) throw new BagreError("disabled");
  if (!isAccepting(row.round, now)) throw new BagreError("closed");
  return row.round;
}

/** Nominates another member with one of their matches in the period. Returns the nomination id. */
export async function nominate(database: Database, userId: string, input: NominateInput, now = new Date()): Promise<string> {
  const round = await roundForMember(database, input.roundId, userId, now);
  if (input.nomineeId === userId) throw new BagreError("self");
  if ((await roleIn(database, round.groupId, input.nomineeId)) === null) throw new BagreError("not_member");

  const [account] = await database
    .select({ puuid: riotAccounts.puuid })
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, input.nomineeId))
    .limit(1);
  if (!account) throw new BagreError("no_account");

  const [played] = await database
    .select({ id: matches.id })
    .from(matchPlayers)
    .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
    .where(
      and(
        eq(matchPlayers.matchId, input.matchId),
        eq(matchPlayers.puuid, account.puuid),
        gte(matches.startedAt, round.startsAt),
        lt(matches.startedAt, round.endsAt),
      ),
    )
    .limit(1);
  if (!played) throw new BagreError("match_not_found");

  try {
    const [created] = await database
      .insert(awardNominations)
      .values({ roundId: round.id, nomineeId: input.nomineeId, nominatorId: userId, matchId: played.id, comment: input.comment })
      .returning({ id: awardNominations.id });
    return created!.id;
  } catch (error) {
    if (isUniqueViolation(error)) throw new BagreError("already_nominated");
    throw error;
  }
}

/** The nominator takes their nomination back while the period is open (its votes go with it). */
export async function withdrawNomination(database: Database, userId: string, nominationId: string, now = new Date()): Promise<void> {
  const [row] = await database
    .select({ roundId: awardNominations.roundId, nominatorId: awardNominations.nominatorId })
    .from(awardNominations)
    .where(eq(awardNominations.id, nominationId))
    .limit(1);
  if (!row) throw new BagreError("not_found");
  await roundForMember(database, row.roundId, userId, now);
  if (row.nominatorId !== userId) throw new BagreError("not_nominator");
  await database
    .delete(awardNominations)
    .where(and(eq(awardNominations.id, nominationId), eq(awardNominations.nominatorId, userId)));
}

/**
 * Casts or changes the caller's vote. The round and group come from the
 * nomination in the database; the caller must be a member, the nominee must
 * still be a member and can't be the caller (the DB CHECK backs this up).
 */
export async function castVote(database: Database, userId: string, nominationId: string, now = new Date()): Promise<void> {
  const [nomination] = await database
    .select({ roundId: awardNominations.roundId, nomineeId: awardNominations.nomineeId })
    .from(awardNominations)
    .where(eq(awardNominations.id, nominationId))
    .limit(1);
  if (!nomination) throw new BagreError("not_found");
  const round = await roundForMember(database, nomination.roundId, userId, now);
  if (nomination.nomineeId === userId) throw new BagreError("self");
  if ((await roleIn(database, round.groupId, nomination.nomineeId)) === null) throw new BagreError("not_member");

  await database
    .insert(awardVotes)
    .values({ roundId: round.id, voterId: userId, nominationId, nomineeId: nomination.nomineeId, createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: [awardVotes.roundId, awardVotes.voterId],
      set: { nominationId: sql`excluded.nomination_id`, nomineeId: sql`excluded.nominee_id`, updatedAt: now },
    });
}
