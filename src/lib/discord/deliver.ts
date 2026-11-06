/**
 * SPEC §3, step 6: after a sync stores new matches, each group with a webhook
 * where a member played gets ONE card per match (all its members listed).
 *
 * Two phases, both idempotent:
 * 1. `queueMatchCards` inserts (group, match) rows into discord_posts with
 *    ON CONFLICT DO NOTHING. The primary key is the "posted once" guarantee:
 *    the same match synced by two members, or by two runs, queues one row.
 * 2. `deliverQueuedCards` claims rows one by one with an atomic
 *    UPDATE … WHERE status IN (queued, failed) RETURNING, posts, and records
 *    the outcome. Two runs at once can't both claim a row. Retryable failures
 *    (429 longer than we can wait, Discord down) are retried by later runs, up
 *    to MAX_ATTEMPTS; permanent ones (webhook deleted) stop at once.
 *
 * Framework-free like src/lib/sync: used by the cron route and "Sincronizar agora".
 */
import { and, asc, eq, gte, inArray, isNotNull, lt, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { discordPosts, groupMembers, groups, matches, matchPlayers, riotAccounts } from "@/db/schema";
import { decrypt } from "@/lib/crypto";
import { webhookContext } from "@/lib/groups/webhook-context";

import { buildMatchCard, type WebhookPayload } from "./card";
import { DiscordWebhookError, postWebhook } from "./webhook";

/** Older matches (a first import, a late sync) never post: the channel is for what just happened. */
export const RECENT_MATCH_MS = 6 * 60 * 60 * 1000;
export const MAX_ATTEMPTS = 3;
/** Rows older than this are abandoned (a card a day late is noise). */
const GIVE_UP_AFTER_MS = 24 * 60 * 60 * 1000;
const BATCH = 20;

/** Pairs (group with a webhook, match) where at least one member of the group played. */
export async function queueMatchCards(database: Database, matchIds: readonly string[], now = new Date()): Promise<number> {
  if (matchIds.length === 0) return 0;
  const pairs = await database
    .selectDistinct({ groupId: groups.id, matchId: matches.id })
    .from(matches)
    .innerJoin(matchPlayers, eq(matchPlayers.matchId, matches.id))
    .innerJoin(riotAccounts, eq(riotAccounts.puuid, matchPlayers.puuid))
    .innerJoin(groupMembers, eq(groupMembers.userId, riotAccounts.userId))
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .where(
      and(
        inArray(matches.id, [...matchIds]),
        gte(matches.startedAt, new Date(now.getTime() - RECENT_MATCH_MS)),
        isNotNull(groups.discordWebhookUrl),
      ),
    );
  if (pairs.length === 0) return 0;
  const inserted = await database
    .insert(discordPosts)
    .values(pairs)
    .onConflictDoNothing()
    .returning({ groupId: discordPosts.groupId });
  return inserted.length;
}

export type Send = (url: string, payload: WebhookPayload, options: { maxWaitMs: number }) => Promise<{ messageId: string | null }>;

export interface DeliverOptions {
  key: Buffer;
  now?: () => Date;
  /** Stop starting new posts after this instant (function time budget). */
  deadline?: number;
  appUrl?: string;
  /** Injected in tests; defaults to the real webhook sender. */
  send?: Send;
  /** Only these matches (e.g. the ones the user just synced). */
  matchIds?: readonly string[];
}

export interface DeliverResult {
  sent: number;
  failed: number;
  skipped: number;
}

const claimable = and(
  inArray(discordPosts.status, ["queued", "failed"]),
  lt(discordPosts.attempts, MAX_ATTEMPTS),
);

/** Builds the card for one claimed row, or explains why there's nothing to send. */
async function cardFor(database: Database, groupId: string, matchId: string, key: Buffer, appUrl?: string) {
  const [group] = await database
    .select({ name: groups.name, webhook: groups.discordWebhookUrl })
    .from(groups)
    .where(eq(groups.id, groupId))
    .limit(1);
  if (!group?.webhook) return { skip: "webhook_removed" } as const;

  let url: string;
  try {
    url = decrypt(group.webhook, key, webhookContext(groupId));
  } catch {
    return { skip: "webhook_unreadable" } as const;
  }

  const [match] = await database.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) return { skip: "match_missing" } as const;
  const players = await database.select().from(matchPlayers).where(eq(matchPlayers.matchId, matchId));
  // Membership is read now, not at queue time: someone who left isn't listed.
  const members = await database
    .select({ puuid: riotAccounts.puuid })
    .from(groupMembers)
    .innerJoin(riotAccounts, eq(riotAccounts.userId, groupMembers.userId))
    .where(and(eq(groupMembers.groupId, groupId), inArray(riotAccounts.puuid, players.map((p) => p.puuid))));
  if (members.length === 0) return { skip: "no_members" } as const;

  const payload = buildMatchCard({ match, players, memberPuuids: members.map((m) => m.puuid), groupName: group.name, appUrl });
  return { url, payload } as const;
}

export async function deliverQueuedCards(database: Database, options: DeliverOptions): Promise<DeliverResult> {
  const now = options.now ?? (() => new Date());
  const send: Send = options.send ?? ((url, payload, o) => postWebhook(url, payload, o));
  const result: DeliverResult = { sent: 0, failed: 0, skipped: 0 };
  if (options.matchIds && options.matchIds.length === 0) return result;

  const due = await database
    .select({ groupId: discordPosts.groupId, matchId: discordPosts.matchId })
    .from(discordPosts)
    .where(
      and(
        claimable,
        gte(discordPosts.createdAt, new Date(now().getTime() - GIVE_UP_AFTER_MS)),
        options.matchIds ? inArray(discordPosts.matchId, [...options.matchIds]) : undefined,
      ),
    )
    .orderBy(asc(discordPosts.createdAt))
    .limit(BATCH);

  for (const row of due) {
    const left = options.deadline === undefined ? Infinity : options.deadline - now().getTime();
    if (left <= 1_000) break;

    const where = and(eq(discordPosts.groupId, row.groupId), eq(discordPosts.matchId, row.matchId));
    const claimed = await database
      .update(discordPosts)
      .set({ status: "sending", attempts: sql`${discordPosts.attempts} + 1` })
      .where(and(where, claimable))
      .returning({ attempts: discordPosts.attempts });
    if (claimed.length === 0) continue; // another run got it first

    try {
      const card = await cardFor(database, row.groupId, row.matchId, options.key, options.appUrl);
      if ("skip" in card) {
        await database
          .update(discordPosts)
          .set({ status: "failed", attempts: MAX_ATTEMPTS, lastError: card.skip })
          .where(where);
        result.skipped++;
        continue;
      }
      const { messageId } = await send(card.url, card.payload, { maxWaitMs: Math.min(10_000, Math.max(0, left - 2_000)) });
      await database.update(discordPosts).set({ status: "sent", messageId, sentAt: now(), lastError: null }).where(where);
      result.sent++;
    } catch (error) {
      const permanent = error instanceof DiscordWebhookError && !error.retryable;
      const message = error instanceof Error ? error.message : String(error);
      await database
        .update(discordPosts)
        .set({ status: "failed", lastError: message.slice(0, 500), ...(permanent ? { attempts: MAX_ATTEMPTS } : {}) })
        .where(where);
      console.error("[discord] card not sent", row.groupId, row.matchId, message);
      result.failed++;
    }
  }
  return result;
}

export interface NotifyResult extends DeliverResult {
  queued: number;
}

/**
 * Step 6 in one call: queue cards for the matches this sync stored, then post
 * what's due. Without `onlyThese`, older retryable rows are delivered too
 * (the cron does that; "Sincronizar agora" only sends the user's own).
 */
export async function notifyNewMatches(
  database: Database,
  matchIds: readonly string[],
  options: DeliverOptions & { onlyThese?: boolean },
): Promise<NotifyResult> {
  const now = options.now ?? (() => new Date());
  const queued = await queueMatchCards(database, matchIds, now());
  const delivered = await deliverQueuedCards(database, { ...options, matchIds: options.onlyThese ? matchIds : undefined });
  return { queued, ...delivered };
}
