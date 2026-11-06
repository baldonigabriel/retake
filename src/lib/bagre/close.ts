/**
 * Closing Bagre periods (docs/SPEC.md §5.6), run by POST /api/cron/sync.
 * Framework-free like src/lib/summary.
 *
 * Idempotency:
 * 1. close: the result is computed, then written with
 *    UPDATE … WHERE id = ? AND status = 'open'. Two runs at once compute the
 *    same thing (nominations and votes stopped at ends_at) and only one
 *    UPDATE matches; running it again finds nothing open.
 * 2. announce: UPDATE … SET announce_status = 'sending' WHERE status IN
 *    (queued, failed) claims the post; "sending" is never retried (a missing
 *    post beats a duplicate). Failures retry up to MAX_ANNOUNCE_ATTEMPTS, for
 *    ANNOUNCE_WINDOW_MS after closing.
 */
import { and, asc, countDistinct, eq, gte, inArray, lt, lte, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { awardNominations, awardRounds, awardVotes, groupMembers, groups, matches, matchPlayers, riotAccounts, type AwardRound } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { DiscordWebhookError, postWebhook, type Send } from "@/lib/discord";
import { webhookContext } from "@/lib/groups/webhook-context";

import { buildBagreCard } from "./card";
import { badgeUntil } from "./period";
import { decideBagre, sortTally, type TallyEntry } from "./result";
import { buildResults, loadResults, type RoundResult } from "./results";
import { CATEGORY } from "./rounds";

export const MAX_ANNOUNCE_ATTEMPTS = 3;
export const ANNOUNCE_WINDOW_MS = 2 * 86_400_000;
const PER_RUN = 10;

export interface BagreRunOptions {
  /** Webhook key; without it periods still close, but nothing is posted. */
  key: Buffer | null;
  now?: () => Date;
  appUrl?: string;
  send?: Send;
  /** Don't start another post after this instant. */
  deadline?: number;
  limit?: number;
  /** Restrict to these groups (tests and manual runs). */
  onlyGroups?: readonly string[];
}

export interface BagreRunResult {
  closed: number;
  outcomes: Partial<Record<string, number>>;
  sent: number;
  failed: number;
}

/** Valid entries of a round: nominations of current members, votes of current members, matches in the period. */
export async function roundTally(database: Database, round: Pick<AwardRound, "id" | "groupId" | "startsAt" | "endsAt">) {
  const memberIds = (
    await database.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, round.groupId))
  ).map((m) => m.userId);
  if (memberIds.length === 0) return { entries: [] as TallyEntry[], votesCast: 0 };

  const noms = await database
    .select({ id: awardNominations.id, nomineeId: awardNominations.nomineeId })
    .from(awardNominations)
    .where(and(eq(awardNominations.roundId, round.id), inArray(awardNominations.nomineeId, memberIds)));
  if (noms.length === 0) return { entries: [] as TallyEntry[], votesCast: 0 };

  const [votes, played] = await Promise.all([
    database
      .select({ nominationId: awardVotes.nominationId })
      .from(awardVotes)
      .where(
        and(
          eq(awardVotes.roundId, round.id),
          inArray(awardVotes.voterId, memberIds),
          inArray(awardVotes.nominationId, noms.map((n) => n.id)),
        ),
      ),
    database
      .select({ userId: riotAccounts.userId, matches: countDistinct(matchPlayers.matchId) })
      .from(riotAccounts)
      .innerJoin(matchPlayers, eq(matchPlayers.puuid, riotAccounts.puuid))
      .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
      .where(
        and(
          inArray(riotAccounts.userId, noms.map((n) => n.nomineeId)),
          gte(matches.startedAt, round.startsAt),
          lt(matches.startedAt, round.endsAt),
        ),
      )
      .groupBy(riotAccounts.userId),
  ]);

  const entries: TallyEntry[] = noms.map((n) => ({
    nominationId: n.id,
    nomineeId: n.nomineeId,
    votes: votes.filter((v) => v.nominationId === n.id).length,
    matches: Number(played.find((p) => p.userId === n.nomineeId)?.matches ?? 0),
  }));
  return { entries, votesCast: votes.length };
}

/** Closes one due round. Returns the outcome, or null when another run closed it first. */
export async function closeRound(
  database: Database,
  round: AwardRound,
  group: { bagreEnabled: boolean; hasWebhook: boolean },
  now: Date,
): Promise<string | null> {
  const { entries, votesCast } = await roundTally(database, round);
  const decision = group.bagreEnabled ? decideBagre(entries) : { outcome: "disabled" as const, tally: sortTally(entries) };
  const winner = decision.outcome === "winner" ? decision.winner : null;
  const announce = group.bagreEnabled && group.hasWebhook && (decision.outcome === "winner" || decision.outcome === "tie");

  const [closed] = await database
    .update(awardRounds)
    .set({
      status: "closed",
      outcome: decision.outcome,
      winnerUserId: winner?.nomineeId ?? null,
      winnerNominationId: winner?.nominationId ?? null,
      tally: decision.tally,
      votesCast,
      badgeUntil: winner ? badgeUntil(round.cadence, round.endsAt) : null,
      closedAt: now,
      announceStatus: announce ? "queued" : null,
    })
    .where(and(eq(awardRounds.id, round.id), eq(awardRounds.status, "open")))
    .returning({ id: awardRounds.id });
  return closed ? decision.outcome : null;
}

/** Posts one closed round's result. Claims it first; a lost claim is a no-op. */
async function announce(database: Database, roundId: string, options: BagreRunOptions & { key: Buffer }, now: Date): Promise<"sent" | "failed" | "skipped"> {
  const send: Send = options.send ?? ((url, payload, o) => postWebhook(url, payload, o));
  const [claimed] = await database
    .update(awardRounds)
    .set({ announceStatus: "sending", announceAttempts: sql`${awardRounds.announceAttempts} + 1` })
    .where(
      and(
        eq(awardRounds.id, roundId),
        inArray(awardRounds.announceStatus, ["queued", "failed"]),
        lt(awardRounds.announceAttempts, MAX_ANNOUNCE_ATTEMPTS),
      ),
    )
    .returning({ groupId: awardRounds.groupId });
  if (!claimed) return "skipped";

  const where = eq(awardRounds.id, roundId);
  try {
    const [group] = await database
      .select({ name: groups.name, slug: groups.slug, webhook: groups.discordWebhookUrl, enabled: groups.bagreEnabled })
      .from(groups)
      .where(eq(groups.id, claimed.groupId))
      .limit(1);
    if (!group?.webhook) throw new DiscordWebhookError("not_found", null, false);
    const [result] = await loadResults(database, claimed.groupId, { roundIds: [roundId], limit: 1 });
    const payload = result ? buildBagreCard({ groupName: group.name, groupSlug: group.slug, result, appUrl: options.appUrl }) : null;
    if (!payload) {
      await database.update(awardRounds).set({ announceStatus: null }).where(where);
      return "skipped";
    }
    let url: string;
    try {
      url = decrypt(group.webhook, options.key, webhookContext(claimed.groupId));
    } catch {
      throw new DiscordWebhookError("unauthorized", null, false);
    }
    const { messageId } = await send(url, payload, { maxWaitMs: 5_000 });
    await database.update(awardRounds).set({ announceStatus: "sent", messageId, sentAt: now, lastError: null }).where(where);
    return "sent";
  } catch (error) {
    const permanent = error instanceof DiscordWebhookError && !error.retryable;
    const message = error instanceof Error ? error.message : String(error);
    await database
      .update(awardRounds)
      .set({
        announceStatus: "failed",
        lastError: message.slice(0, 500),
        ...(permanent ? { announceAttempts: MAX_ANNOUNCE_ATTEMPTS } : {}),
      })
      .where(where);
    console.error("[bagre] result not posted", roundId, message);
    return "failed";
  }
}

export async function runBagreClosing(database: Database, options: BagreRunOptions): Promise<BagreRunResult> {
  const now = options.now ?? (() => new Date());
  const result: BagreRunResult = { closed: 0, outcomes: {}, sent: 0, failed: 0 };
  const only = options.onlyGroups ? inArray(awardRounds.groupId, [...options.onlyGroups]) : undefined;

  const due = await database
    .select({ round: awardRounds, enabled: groups.bagreEnabled, webhook: groups.discordWebhookUrl })
    .from(awardRounds)
    .innerJoin(groups, eq(groups.id, awardRounds.groupId))
    .where(and(eq(awardRounds.category, CATEGORY), eq(awardRounds.status, "open"), lte(awardRounds.endsAt, now()), only))
    .orderBy(asc(awardRounds.endsAt))
    .limit(options.limit ?? PER_RUN);

  for (const { round, enabled, webhook } of due) {
    const outcome = await closeRound(database, round, { bagreEnabled: enabled, hasWebhook: webhook !== null }, now());
    if (!outcome) continue;
    result.closed++;
    result.outcomes[outcome] = (result.outcomes[outcome] ?? 0) + 1;
    console.info("[bagre] closed", round.id, outcome);
  }

  if (!options.key) return result;
  const pending = await database
    .select({ id: awardRounds.id })
    .from(awardRounds)
    .where(
      and(
        eq(awardRounds.category, CATEGORY),
        eq(awardRounds.status, "closed"),
        inArray(awardRounds.announceStatus, ["queued", "failed"]),
        lt(awardRounds.announceAttempts, MAX_ANNOUNCE_ATTEMPTS),
        gte(awardRounds.closedAt, new Date(now().getTime() - ANNOUNCE_WINDOW_MS)),
        only,
      ),
    )
    .orderBy(asc(awardRounds.closedAt))
    .limit(options.limit ?? PER_RUN);

  for (const { id } of pending) {
    if (options.deadline !== undefined && now().getTime() > options.deadline) break;
    const outcome = await announce(database, id, { ...options, key: options.key }, now());
    if (outcome === "sent") result.sent++;
    if (outcome === "failed") result.failed++;
  }
  return result;
}

/**
 * What closing `round` at `now` would produce, without writing anything
 * (pnpm bagre:once). Same tally, decision and card as the real close.
 */
export async function previewClose(database: Database, round: AwardRound, enabled: boolean, now: Date): Promise<RoundResult | null> {
  const { entries, votesCast } = await roundTally(database, round);
  const decision = enabled ? decideBagre(entries) : { outcome: "disabled" as const, tally: sortTally(entries) };
  const winner = decision.outcome === "winner" ? decision.winner : null;
  const simulated: AwardRound = {
    ...round,
    status: "closed",
    outcome: decision.outcome,
    winnerUserId: winner?.nomineeId ?? null,
    winnerNominationId: winner?.nominationId ?? null,
    tally: decision.tally,
    votesCast,
    badgeUntil: winner ? badgeUntil(round.cadence, round.endsAt) : null,
    closedAt: now,
  };
  const [result] = await buildResults(database, round.groupId, [simulated]);
  return result ?? null;
}
