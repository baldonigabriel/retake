/**
 * Weekly summary, posted once per group and week by the cron route
 * (POST /api/cron/sync). Framework-free like src/lib/discord.
 *
 * When: from Monday 09:00 (São Paulo) on, for the week that just ended, so
 * late Sunday matches have been synced. Each cron run handles at most
 * PER_RUN groups and only starts one when there's time for the whole AI chain.
 *
 * Idempotency (weekly_summaries, PK group + week):
 * 1. claim: INSERT … ON CONFLICT DO NOTHING (status "generating");
 * 2. write: numbers by code → text by the AI chain or rules → "ready", with
 *    the provider saved. The text is written once; a failed post reuses it;
 * 3. post: UPDATE … WHERE status IN (ready, failed) → "sending" → "sent".
 * Two runs at once can't both claim either step. "sending" is never retried.
 */
import { and, asc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from "drizzle-orm";

import type { Database } from "@/db";
import { groupMembers, groups, matches, matchPlayers, riotAccounts, users, weeklySummaries } from "@/db/schema";
import type { TextProvider } from "@/lib/ai";
import { accountDisplayName } from "@/lib/auth/display-name";
import { decrypt } from "@/lib/crypto";
import { DiscordWebhookError, postWebhook, type Send, type WebhookPayload } from "@/lib/discord";
import { webhookContext } from "@/lib/groups/webhook-context";
import type { GroupLine, GroupMember } from "@/lib/groups/ranking";
import { formatWeek, previousWeek, weekRange, type WeekRange } from "@/lib/groups/week";

import { buildSummaryCard } from "./card";
import { buildWeeklyStats, isEmptyWeek, type WeeklyStats } from "./stats";
import { writeSummary, type SummaryText } from "./text";

export const SUMMARY_DUE_HOUR = 9;
export const MAX_SUMMARY_ATTEMPTS = 3;
const STALE_GENERATING_MS = 15 * 60_000;
const PER_RUN = 2;
/** Time a group needs: two AI calls (8 s timeout each) plus the post. */
export const SUMMARY_TIME_NEEDED_MS = 21_000;

/** The week to summarise now, or null before Monday 09:00 of the week after it. */
export function summaryWeekDue(now: Date): WeekRange | null {
  const current = weekRange(now);
  if (now.getTime() < current.start.getTime() + SUMMARY_DUE_HOUR * 3_600_000) return null;
  return previousWeek(current);
}

/* ------------------------------------------------------------- data -- */

/** Members (with or without Riot ID) and their lines in [previous week, week). Only members' puuids. */
export async function loadGroupWeek(database: Database, groupId: string, week: WeekRange) {
  const before = previousWeek(week);
  const rows = await database
    .select({
      userId: users.id,
      providerName: users.name,
      image: users.image,
      role: groupMembers.role,
      puuid: riotAccounts.puuid,
      gameName: riotAccounts.gameName,
      tagLine: riotAccounts.tagLine,
    })
    .from(groupMembers)
    .innerJoin(users, eq(users.id, groupMembers.userId))
    .leftJoin(riotAccounts, eq(riotAccounts.userId, users.id))
    .where(eq(groupMembers.groupId, groupId))
    .orderBy(asc(groupMembers.joinedAt));
  const members: GroupMember[] = rows.map((r) => ({
    userId: r.userId,
    puuid: r.puuid,
    name: accountDisplayName(r.providerName, r.gameName),
    tag: r.tagLine,
    image: r.image,
    role: r.role,
    isYou: false,
  }));
  const puuids = members.flatMap((m) => (m.puuid ? [m.puuid] : []));
  const lines: GroupLine[] =
    puuids.length === 0
      ? []
      : await database
          .select({
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
          })
          .from(matchPlayers)
          .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
          .where(and(inArray(matchPlayers.puuid, puuids), gte(matches.startedAt, before.start), lt(matches.startedAt, week.end)));
  return { members, lines, previousWeek: before };
}

export async function groupWeeklyStats(database: Database, group: { id: string; name: string }, week: WeekRange): Promise<WeeklyStats> {
  const { members, lines, previousWeek: before } = await loadGroupWeek(database, group.id, week);
  return buildWeeklyStats({ groupName: group.name, weekLabel: formatWeek(week), members, lines, week, previousWeek: before });
}

export interface PreparedSummary extends SummaryText {
  stats: WeeklyStats;
  payload: WebhookPayload;
}

/** Numbers → text → card, without touching weekly_summaries (also used by scripts/summary-once.ts). */
export async function prepareSummary(
  database: Database,
  group: { id: string; name: string; slug: string },
  week: WeekRange,
  providers: readonly TextProvider[],
  appUrl?: string,
): Promise<PreparedSummary> {
  const stats = await groupWeeklyStats(database, group, week);
  const written = await writeSummary(stats, providers);
  const payload = buildSummaryCard({ stats, ...written, groupUrl: appUrl ? `${appUrl}/groups/${group.slug}` : undefined });
  return { ...written, stats, payload };
}

/* -------------------------------------------------------------- run -- */

export interface WeeklyRunOptions {
  key: Buffer;
  providers: readonly TextProvider[];
  now?: () => Date;
  /** Don't start a group after this instant (function time budget). */
  deadline?: number;
  appUrl?: string;
  send?: Send;
  limit?: number;
  /** Restrict the run to these groups (tests and manual runs). */
  onlyGroups?: readonly string[];
}

export interface WeeklyRunResult {
  due: boolean;
  weekStart?: string;
  generated: number;
  sent: number;
  skipped: number;
  failed: number;
  /** Who wrote each text generated in this run. */
  providers: string[];
}

export async function runWeeklySummaries(database: Database, options: WeeklyRunOptions): Promise<WeeklyRunResult> {
  const now = options.now ?? (() => new Date());
  const send: Send = options.send ?? ((url, payload, o) => postWebhook(url, payload, o));
  const result: WeeklyRunResult = { due: false, generated: 0, sent: 0, skipped: 0, failed: 0, providers: [] };
  const week = summaryWeekDue(now());
  if (!week) return result;
  result.due = true;
  result.weekStart = week.start.toISOString();

  const stale = new Date(now().getTime() - STALE_GENERATING_MS);
  const pending = await database
    .select({ id: groups.id, name: groups.name, slug: groups.slug, webhook: groups.discordWebhookUrl, status: weeklySummaries.status })
    .from(groups)
    .leftJoin(weeklySummaries, and(eq(weeklySummaries.groupId, groups.id), eq(weeklySummaries.weekStart, week.start)))
    .where(
      and(
        isNotNull(groups.discordWebhookUrl),
        options.onlyGroups ? inArray(groups.id, [...options.onlyGroups]) : undefined,
        or(
          isNull(weeklySummaries.groupId),
          eq(weeklySummaries.status, "ready"),
          and(eq(weeklySummaries.status, "failed"), lt(weeklySummaries.attempts, MAX_SUMMARY_ATTEMPTS)),
          and(eq(weeklySummaries.status, "generating"), lt(weeklySummaries.updatedAt, stale)),
        ),
      ),
    )
    .orderBy(asc(groups.createdAt))
    .limit(options.limit ?? PER_RUN);

  for (const group of pending) {
    const left = options.deadline === undefined ? Infinity : options.deadline - now().getTime();
    if (left < SUMMARY_TIME_NEEDED_MS) break;
    const where = and(eq(weeklySummaries.groupId, group.id), eq(weeklySummaries.weekStart, week.start));

    // 1. Claim the right to write the text (new row, or a "generating" left behind by a dead run).
    if (group.status === null || group.status === "generating") {
      const claimed =
        group.status === null
          ? await database
              .insert(weeklySummaries)
              .values({ groupId: group.id, weekStart: week.start, status: "generating", updatedAt: now() })
              .onConflictDoNothing()
              .returning({ groupId: weeklySummaries.groupId })
          : await database
              .update(weeklySummaries)
              .set({ updatedAt: now() })
              .where(and(where, eq(weeklySummaries.status, "generating"), lt(weeklySummaries.updatedAt, stale)))
              .returning({ groupId: weeklySummaries.groupId });
      if (claimed.length === 0) continue; // another run has it

      // 2. Numbers, then text. Saved before posting, so a failed post never rewrites it.
      try {
        const stats = await groupWeeklyStats(database, group, week);
        if (isEmptyWeek(stats)) {
          await database.update(weeklySummaries).set({ status: "skipped", stats, updatedAt: now() }).where(where);
          result.skipped++;
          continue;
        }
        const written = await writeSummary(stats, options.providers);
        await database
          .update(weeklySummaries)
          .set({ status: "ready", stats, text: written.text, provider: written.provider, model: written.model, updatedAt: now() })
          .where(where);
        result.generated++;
        result.providers.push(written.provider);
        console.info("[summary] written", group.id, written.provider, JSON.stringify(written.attempts));
      } catch (error) {
        // Leave it in "generating": a later run reclaims it once it's stale.
        console.error("[summary] could not write", group.id, error);
        result.failed++;
        continue;
      }
    }

    // 3. Claim the post.
    const [row] = await database
      .update(weeklySummaries)
      .set({ status: "sending", attempts: sql`${weeklySummaries.attempts} + 1`, updatedAt: now() })
      .where(and(where, inArray(weeklySummaries.status, ["ready", "failed"]), lt(weeklySummaries.attempts, MAX_SUMMARY_ATTEMPTS)))
      .returning();
    if (!row?.text || !row.provider || !row.stats) continue;

    try {
      if (!group.webhook) throw new DiscordWebhookError("not_found", null, false);
      let url: string;
      try {
        url = decrypt(group.webhook, options.key, webhookContext(group.id));
      } catch {
        throw new DiscordWebhookError("unauthorized", null, false);
      }
      const payload = buildSummaryCard({
        stats: row.stats as WeeklyStats,
        text: row.text,
        provider: row.provider,
        model: row.model,
        groupUrl: options.appUrl ? `${options.appUrl}/groups/${group.slug}` : undefined,
      });
      const { messageId } = await send(url, payload, { maxWaitMs: 5_000 });
      await database.update(weeklySummaries).set({ status: "sent", messageId, sentAt: now(), lastError: null, updatedAt: now() }).where(where);
      result.sent++;
    } catch (error) {
      const permanent = error instanceof DiscordWebhookError && !error.retryable;
      const message = error instanceof Error ? error.message : String(error);
      await database
        .update(weeklySummaries)
        .set({ status: "failed", lastError: message.slice(0, 500), updatedAt: now(), ...(permanent ? { attempts: MAX_SUMMARY_ATTEMPTS } : {}) })
        .where(where);
      console.error("[summary] not sent", group.id, message);
      result.failed++;
    }
  }
  return result;
}
