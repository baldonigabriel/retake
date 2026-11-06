/**
 * Discord cards against the real database (no browser): one card per match
 * and group even when the match is queued twice and two deliveries race,
 * old matches never post, and failures are retried or dropped as they should.
 * The webhook sender is faked: nothing reaches Discord.
 */
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { discordPosts, groupMembers, groups, matches, matchPlayers } from "@/db/schema";
import { encrypt, serverKey } from "@/lib/crypto";
import { DiscordWebhookError, MAX_ATTEMPTS, deliverQueuedCards, queueMatchCards, type Send, type WebhookPayload } from "@/lib/discord";
import { webhookContext } from "@/lib/groups/webhook-context";

import { E2E, weekMatchId } from "./support/seed";

const MATCH = `${E2E.matchPrefix}discord`;
const HOOK = "https://discord.com/api/webhooks/123456789012345678/e2e-discord-token-aaaaaaaaaaaaaaaaaaaa";
let groupId = "";

// Database-only: run once, not once per viewport.
test.skip(({ isMobile }) => isMobile, "runs in the desktop project only");
test.describe.configure({ mode: "serial" });

function fakeSend(behaviour: (call: number) => Promise<{ messageId: string | null }> = async () => ({ messageId: "msg-1" })) {
  const calls: WebhookPayload[] = [];
  const send: Send = async (url, payload) => {
    if (url !== HOOK) return { messageId: null }; // another test's group: ignore
    calls.push(payload);
    return behaviour(calls.length);
  };
  return { send, calls };
}

const row = async () =>
  (await db().select().from(discordPosts).where(and(eq(discordPosts.groupId, groupId), eq(discordPosts.matchId, MATCH))))[0];

test.beforeAll(async () => {
  const database = db();
  const now = Date.now();
  const [group] = await database
    .insert(groups)
    .values({ name: "Canal E2E", slug: "e2e-discord", ownerId: E2E.friendUserId, inviteCode: "e2eDiscordInviteCode0001" })
    .returning({ id: groups.id });
  groupId = group!.id;
  await database.update(groups).set({ discordWebhookUrl: encrypt(HOOK, serverKey(), webhookContext(groupId)) }).where(eq(groups.id, groupId));
  await database.insert(groupMembers).values([
    { groupId, userId: E2E.friendUserId, role: "owner" },
    { groupId, userId: E2E.userId, role: "member" },
  ]);

  await database.insert(matches).values({
    id: MATCH,
    mapId: "7eaecc1b-4337-bbf6-6ab9-04b8f06b3319",
    mapName: "Ascent",
    mode: "Competitive",
    queueId: "competitive",
    startedAt: new Date(now - 60 * 60_000),
    gameLengthMs: 35 * 60_000,
    roundsPlayed: 22,
    redScore: 13,
    blueScore: 9,
    winningTeam: "Red",
  });
  await database.insert(matchPlayers).values(
    Array.from({ length: 10 }, (_, p) => ({
      matchId: MATCH,
      puuid: p === 0 ? E2E.puuid : p === 1 ? E2E.friendPuuid : `e2e-puuid-discord-${p}`,
      gameName: p === 0 ? E2E.gameName : p === 1 ? E2E.friendName : `Jogador ${p}`,
      tagLine: p < 2 ? E2E.tagLine : "XYZ",
      team: p < 5 ? "Red" : "Blue",
      agentId: "add6443a-41bd-e414-f6ad-e58d267f4e95",
      agentName: "Jett",
      kills: 20 - p,
      deaths: 14,
      assists: 5,
      score: 5302 - p * 200,
      damageDealt: 3476,
      damageReceived: 3000,
      headshots: 10,
      bodyshots: 30,
      legshots: 2,
      won: p < 5,
    })),
  );
});

test.afterAll(async () => {
  await db().delete(matches).where(eq(matches.id, MATCH));
  if (groupId) await db().delete(groups).where(eq(groups.id, groupId));
});

test("queues one card per group and match, however many times it's queued", async () => {
  await queueMatchCards(db(), [MATCH]);
  await queueMatchCards(db(), [MATCH, MATCH]);
  const rows = await db().select().from(discordPosts).where(eq(discordPosts.groupId, groupId));
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ matchId: MATCH, status: "queued", attempts: 0 });
});

test("never queues an old match (first import, late sync)", async () => {
  await queueMatchCards(db(), [weekMatchId(0)], new Date(Date.now() + 8 * 24 * 3_600_000));
  const rows = await db().select().from(discordPosts).where(eq(discordPosts.groupId, groupId));
  expect(rows.map((r) => r.matchId)).toEqual([MATCH]);
});

test("a retryable failure is retried; two racing deliveries post exactly once", async () => {
  const key = serverKey();
  const flaky = fakeSend(async () => {
    throw new DiscordWebhookError("rate_limited", 429, true, 60_000);
  });
  await deliverQueuedCards(db(), { key, send: flaky.send, matchIds: [MATCH] });
  expect(flaky.calls).toHaveLength(1);
  expect(await row()).toMatchObject({ status: "failed", attempts: 1 });

  const ok = fakeSend();
  await Promise.all([
    deliverQueuedCards(db(), { key, send: ok.send, matchIds: [MATCH], appUrl: "https://retake.example" }),
    deliverQueuedCards(db(), { key, send: ok.send, matchIds: [MATCH], appUrl: "https://retake.example" }),
  ]);
  expect(ok.calls).toHaveLength(1);
  expect(await row()).toMatchObject({ status: "sent", attempts: 2, messageId: "msg-1" });

  // One card listing both members, best ACS first, with the highlight.
  const [embed] = ok.calls[0]!.embeds;
  expect(embed!.title).toBe("Vitória em Ascent · 13–9");
  expect(embed!.url).toBe(`https://retake.example/match/${MATCH}`);
  expect(embed!.fields!.map((f) => f.name)).toEqual([`${E2E.gameName} · Jett`, `${E2E.friendName} · Jett`, "Destaque"]);

  // Already sent: a new run (or a requeue) posts nothing.
  await queueMatchCards(db(), [MATCH]);
  const again = fakeSend();
  await deliverQueuedCards(db(), { key, send: again.send, matchIds: [MATCH] });
  expect(again.calls).toHaveLength(0);
});

test("a deleted webhook stops retries at once", async () => {
  await db().update(discordPosts).set({ status: "queued", attempts: 0 }).where(eq(discordPosts.groupId, groupId));
  const gone = fakeSend(async () => {
    throw new DiscordWebhookError("not_found", 404, false);
  });
  await deliverQueuedCards(db(), { key: serverKey(), send: gone.send, matchIds: [MATCH] });
  expect(await row()).toMatchObject({ status: "failed", attempts: MAX_ATTEMPTS });

  await deliverQueuedCards(db(), { key: serverKey(), send: gone.send, matchIds: [MATCH] });
  expect(gone.calls).toHaveLength(1);
});
