/**
 * Weekly summary against the real database (no browser): posted once per
 * group and week even when two cron runs race, the provider that wrote the
 * text is saved, a failed post is retried with the SAME text (no new AI
 * call), and an empty week posts nothing. Providers and the webhook sender
 * are fakes: nothing reaches Discord or an AI service.
 */
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { groupMembers, groups, weeklySummaries } from "@/db/schema";
import { AiError, resetCooldowns, type TextProvider } from "@/lib/ai";
import { encrypt, serverKey } from "@/lib/crypto";
import { DiscordWebhookError, type Send, type WebhookPayload } from "@/lib/discord";
import { webhookContext } from "@/lib/groups/webhook-context";
import { weekRange } from "@/lib/groups/week";
import { runWeeklySummaries } from "@/lib/summary";

import { E2E } from "./support/seed";

const HOOK = "https://discord.com/api/webhooks/123456789012345678/e2e-summary-token-aaaaaaaaaaaaaaaaaaaa";
const EMPTY_HOOK = "https://discord.com/api/webhooks/123456789012345678/e2e-summary-empty-aaaaaaaaaaaaaaaaaa";
let groupId = "";
let emptyGroupId = "";

test.skip(({ isMobile }) => isMobile, "runs in the desktop project only");
test.describe.configure({ mode: "serial" });

// The seeded week matches are in the current week; summarise it as if it were next Monday 10:00.
const thisWeek = weekRange(new Date());
// week.end is Monday 00:00 in São Paulo, so +10 h is 10:00 there.
const mondayAfter = () => new Date(thisWeek.end.getTime() + 10 * 3_600_000);

function fakeProviders(calls: string[]): TextProvider[] {
  return [
    {
      id: "gemini",
      model: "gemini-test",
      async generate() {
        calls.push("gemini");
        throw new AiError("gemini", "rate_limited", 429, 60_000);
      },
    },
    {
      id: "groq",
      model: "groq-test",
      async generate() {
        calls.push("groq");
        return "Semana do Esquadrão E2E com Parceiro de MVP e a galera jogando junto. Resumo de teste escrito pelo provedor falso.";
      },
    },
  ];
}

function fakeSend(fail = false) {
  const calls: WebhookPayload[] = [];
  const send: Send = async (url, payload) => {
    if (url !== HOOK && url !== EMPTY_HOOK) return { messageId: null };
    calls.push(payload);
    if (fail) throw new DiscordWebhookError("server", 503, true);
    return { messageId: `msg-${calls.length}` };
  };
  return { send, calls };
}

const row = async (id = groupId) =>
  (await db().select().from(weeklySummaries).where(and(eq(weeklySummaries.groupId, id), eq(weeklySummaries.weekStart, thisWeek.start))))[0];

test.beforeAll(async ({}, testInfo) => {
  // Hooks run even in skipped projects: only the desktop project sets up.
  if (testInfo.project.name !== "desktop-1440") return;
  const database = db();
  const [group] = await database
    .insert(groups)
    .values({ name: "Resumo E2E", slug: "e2e-summary", ownerId: E2E.friendUserId, inviteCode: "e2eSummaryInviteCode0001" })
    .returning({ id: groups.id });
  groupId = group!.id;
  await database.update(groups).set({ discordWebhookUrl: encrypt(HOOK, serverKey(), webhookContext(groupId)) }).where(eq(groups.id, groupId));
  await database.insert(groupMembers).values([
    { groupId, userId: E2E.friendUserId, role: "owner" },
    { groupId, userId: E2E.userId, role: "member" },
  ]);

  // Vazio has no matches at all: nothing to summarise.
  const [empty] = await database
    .insert(groups)
    .values({ name: "Vazio E2E", slug: "e2e-summary-empty", ownerId: E2E.emptyUserId, inviteCode: "e2eSummaryEmptyCode00001" })
    .returning({ id: groups.id });
  emptyGroupId = empty!.id;
  await database.update(groups).set({ discordWebhookUrl: encrypt(EMPTY_HOOK, serverKey(), webhookContext(emptyGroupId)) }).where(eq(groups.id, emptyGroupId));
  await database.insert(groupMembers).values({ groupId: emptyGroupId, userId: E2E.emptyUserId, role: "owner" });
});

test.afterAll(async () => {
  if (groupId) await db().delete(groups).where(eq(groups.id, groupId));
  if (emptyGroupId) await db().delete(groups).where(eq(groups.id, emptyGroupId));
});

test("nothing is due before Monday 09:00", async () => {
  const { send, calls } = fakeSend();
  const result = await runWeeklySummaries(db(), { key: serverKey(), providers: [], send, now: () => new Date(thisWeek.end.getTime() + 8 * 3_600_000), onlyGroups: [groupId] });
  expect(result.due).toBe(false);
  expect(calls).toHaveLength(0);
});

test("a failed post keeps the text; the retry sends the same text without asking the AI again", async () => {
  resetCooldowns();
  const ai: string[] = [];
  const failing = fakeSend(true);
  const first = await runWeeklySummaries(db(), { key: serverKey(), providers: fakeProviders(ai), send: failing.send, now: mondayAfter, onlyGroups: [groupId] });
  expect(first).toMatchObject({ due: true, generated: 1, failed: 1, providers: ["groq"] });
  expect(ai).toEqual(["gemini", "groq"]);
  const saved = await row();
  expect(saved).toMatchObject({ status: "failed", provider: "groq", model: "groq-test", attempts: 1 });

  const ok = fakeSend();
  const second = await runWeeklySummaries(db(), { key: serverKey(), providers: fakeProviders(ai), send: ok.send, now: mondayAfter, onlyGroups: [groupId] });
  expect(second).toMatchObject({ generated: 0, sent: 1 });
  expect(ai).toEqual(["gemini", "groq"]); // no new AI call
  expect(ok.calls[0]!.embeds[0]!.description).toBe(saved!.text);
  expect(ok.calls[0]!.embeds[0]!.footer!.text).toContain("Groq · groq-test");
  expect(await row()).toMatchObject({ status: "sent", messageId: "msg-1", attempts: 2 });
});

test("two runs at once post once, and later runs post nothing", async () => {
  await db().delete(weeklySummaries).where(eq(weeklySummaries.groupId, groupId));
  resetCooldowns();
  const { send, calls } = fakeSend();
  const options = { key: serverKey(), providers: fakeProviders([]), send, now: mondayAfter, onlyGroups: [groupId] };
  await Promise.all([runWeeklySummaries(db(), options), runWeeklySummaries(db(), options)]);
  expect(calls).toHaveLength(1);
  const posted = calls[0]!.embeds[0]!;
  expect(posted.title).toBe("Resumo da semana · Resumo E2E");
  expect(posted.fields!.find((f) => f.name === "MVP")?.value).toContain(E2E.friendName);

  await runWeeklySummaries(db(), options);
  expect(calls).toHaveLength(1);
});

test("an empty week is skipped, not posted", async () => {
  const { send, calls } = fakeSend();
  const result = await runWeeklySummaries(db(), { key: serverKey(), providers: fakeProviders([]), send, now: mondayAfter, onlyGroups: [emptyGroupId] });
  expect(result).toMatchObject({ skipped: 1, sent: 0 });
  expect(calls).toHaveLength(0);
  expect(await row(emptyGroupId)).toMatchObject({ status: "skipped" });
});
