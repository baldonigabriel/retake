/**
 * Bagre, end to end against the real database: nominate, vote, change the
 * vote, close (twice: nothing duplicates) and the access rules (outsiders
 * don't see or vote, nobody votes for themselves). The Discord sender is a
 * fake: nothing reaches Discord.
 *
 * Seed: "Bagre E2E" = Tester (owner) + Parceiro + Terceiro; Vazio is the
 * outsider. Terceiro has three rough competitive matches this week (the
 * suggestions pick him); last week's period is already closed with Tester
 * as the Bagre (nominated by Parceiro).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { and, count, eq } from "drizzle-orm";

import { db } from "@/db";
import { awardNominations, awardRounds, awardVotes, groups } from "@/db/schema";
import { BagreError } from "@/lib/bagre/errors";
import { runBagreClosing } from "@/lib/bagre/close";
import { castVote, nominate, withdrawNomination } from "@/lib/bagre/mutations";
import { encrypt, serverKey } from "@/lib/crypto";
import type { Send, WebhookPayload } from "@/lib/discord";
import { webhookContext } from "@/lib/groups/webhook-context";
import { weekRange } from "@/lib/groups/week";

import { EMPTY_STATE, FRIEND_STATE, ONBOARDED_STATE, THIRD_STATE } from "./global-setup";
import { E2E, PAST_BAGRE_COMMENT, thirdMatchId, weekMatchId } from "./support/seed";

const BAGRE = `/groups/${E2E.bagreSlug}/bagre`;
const HOOK = "https://discord.com/api/webhooks/123456789012345678/e2e-bagre-token-aaaaaaaaaaaaaaaaaaaaaaa";

test.describe.configure({ mode: "serial" });

async function as(browser: Browser, storageState: string) {
  const context = await browser.newContext({ storageState });
  return { context, page: await context.newPage() };
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

const groupId = async () => (await db().select({ id: groups.id }).from(groups).where(eq(groups.slug, E2E.bagreSlug)))[0]!.id;
const currentRound = async () => {
  const week = weekRange(new Date());
  return (
    await db()
      .select()
      .from(awardRounds)
      .where(and(eq(awardRounds.groupId, await groupId()), eq(awardRounds.startsAt, week.start)))
  )[0];
};
const nominationOf = async (nomineeId: string) => {
  const round = await currentRound();
  return (
    await db()
      .select()
      .from(awardNominations)
      .where(and(eq(awardNominations.roundId, round!.id), eq(awardNominations.nomineeId, nomineeId)))
  )[0]!;
};
const codeOf = async (promise: Promise<unknown>) => {
  try {
    await promise;
    return "ok";
  } catch (error) {
    return error instanceof BagreError ? error.code : `unexpected: ${String(error)}`;
  }
};

test.describe("bagre", () => {
  test.skip(({ isMobile }) => isMobile, "the flow runs once, in the desktop project");

  test.beforeAll(async ({}, testInfo) => {
    if (testInfo.project.name !== "desktop-1440") return;
    const id = await groupId();
    await db().update(groups).set({ discordWebhookUrl: encrypt(HOOK, serverKey(), webhookContext(id)) }).where(eq(groups.id, id));
  });

  test("an outsider gets the same 404 as a missing group", async ({ browser }) => {
    const { context, page } = await as(browser, EMPTY_STATE);
    await page.goto(BAGRE);
    await expect(page.getByText("Grupo não encontrado").first()).toBeVisible();
    await expect(page.getByText(E2E.bagreName)).toHaveCount(0);
    await expect(page.getByText(E2E.thirdName)).toHaveCount(0);
    await context.close();
  });

  test("the screen opens the period, suggests from the numbers and shows last week's result", async ({ browser }) => {
    const { context, page } = await as(browser, ONBOARDED_STATE);
    await page.goto(BAGRE);
    await expect(page.getByRole("heading", { level: 1, name: "Bagre da Semana" })).toBeVisible();
    await expect(page.getByText("Ninguém foi indicado ainda, que tal começar?")).toBeVisible();
    // Terceiro's three rough matches: lowest average ACS of the group.
    const suggestions = page.getByRole("region", { name: "Sugestões dos números" });
    await expect(suggestions.getByText("Menor ACS médio")).toBeVisible();
    await expect(suggestions.getByText(/ACS médio 124 em 3 competitivas/)).toBeVisible();
    // Last week's Bagre: Tester, with the badge, on top and in the history.
    const result = page.getByRole("region", { name: /Resultado/ });
    await expect(result.getByText(PAST_BAGRE_COMMENT, { exact: false })).toBeVisible();
    await expect(result.getByText("Bagre da Semana")).toBeVisible();
    await expect(page.getByRole("region", { name: "Histórico de Bagres" }).getByText(PAST_BAGRE_COMMENT, { exact: false })).toBeVisible();
    expect(await currentRound()).toBeTruthy();
    await context.close();
  });

  test("members nominate: from a suggestion and from the dialog, never themselves", async ({ browser }) => {
    const tester = await as(browser, ONBOARDED_STATE);
    await tester.page.goto(BAGRE);
    await tester.page.getByRole("button", { name: `Indicar ${E2E.thirdName}` }).click();
    const dialog = tester.page.getByRole("dialog", { name: "Indicar ao Bagre" });
    // Prefilled with Terceiro and the suggested match.
    await expect(dialog.getByRole("radio", { name: new RegExp(E2E.thirdName) })).toBeChecked();
    await expect(dialog.locator(`input[name="match"]:checked`)).toHaveCount(1);
    // The 140-character limit is checked before sending.
    await dialog.getByLabel("Motivo").fill("x".repeat(141));
    await dialog.getByRole("button", { name: "Indicar", exact: true }).click();
    await expect(dialog.getByRole("alert")).toHaveText("Use no máximo 140 caracteres.");
    await dialog.getByLabel("Motivo").fill("Cinco abates em 17 rounds e um smoke no próprio pé");
    await dialog.getByRole("button", { name: "Indicar", exact: true }).click();
    await expect(dialog).toBeHidden();
    await expect(tester.page.getByText("“Cinco abates em 17 rounds e um smoke no próprio pé”")).toBeVisible();
    await expect(tester.page.getByText("Vote para ver a contagem", { exact: false })).toBeVisible();
    await tester.context.close();

    const friend = await as(browser, FRIEND_STATE);
    await friend.page.goto(BAGRE);
    await friend.page.getByRole("button", { name: "Indicar alguém" }).first().click();
    const form = friend.page.getByRole("dialog", { name: "Indicar ao Bagre" });
    // Parceiro isn't offered (no self nomination) and Terceiro is already nominated.
    await expect(form.getByRole("radio", { name: new RegExp(E2E.friendName) })).toHaveCount(0);
    await expect(form.getByRole("radio", { name: new RegExp(E2E.thirdName) })).toBeDisabled();
    await form.getByText(E2E.gameName, { exact: true }).click();
    await form.locator('input[name="match"]').first().check({ force: true });
    await form.getByLabel("Motivo").fill("Prometeu carregar e foi carregado");
    await form.getByRole("button", { name: "Indicar", exact: true }).click();
    await expect(form).toBeHidden();
    await expect(friend.page.getByText("“Prometeu carregar e foi carregado”")).toBeVisible();
    await friend.context.close();
  });

  test("the server enforces the rules, whatever the client sends", async () => {
    const database = db();
    const round = (await currentRound())!;
    const thirdNomination = await nominationOf(E2E.thirdUserId);
    const testerNomination = await nominationOf(E2E.userId);

    // Outsiders can't nominate, vote or withdraw, and learn nothing ("not_found").
    expect(await codeOf(nominate(database, E2E.emptyUserId, { roundId: round.id, nomineeId: E2E.friendUserId, matchId: weekMatchId(0), comment: "oi" }))).toBe("not_found");
    expect(await codeOf(castVote(database, E2E.emptyUserId, thirdNomination.id))).toBe("not_found");
    expect(await codeOf(withdrawNomination(database, E2E.emptyUserId, thirdNomination.id))).toBe("not_found");
    // Nobody votes for or nominates themselves.
    expect(await codeOf(castVote(database, E2E.thirdUserId, thirdNomination.id))).toBe("self");
    expect(await codeOf(nominate(database, E2E.friendUserId, { roundId: round.id, nomineeId: E2E.friendUserId, matchId: weekMatchId(0), comment: "eu" }))).toBe("self");
    // …not even writing straight to the database: the CHECK holds.
    await expect(
      database.insert(awardVotes).values({ roundId: round.id, voterId: E2E.thirdUserId, nominationId: thirdNomination.id, nomineeId: E2E.thirdUserId }),
    ).rejects.toThrow();
    // A vote can't lie about the nominee (composite FK).
    await expect(
      database.insert(awardVotes).values({ roundId: round.id, voterId: E2E.friendUserId, nominationId: thirdNomination.id, nomineeId: E2E.userId }),
    ).rejects.toThrow();
    // Only members of this group, with a match of theirs in the period, once per period.
    expect(await codeOf(nominate(database, E2E.userId, { roundId: round.id, nomineeId: E2E.emptyUserId, matchId: weekMatchId(0), comment: "fora" }))).toBe("not_member");
    expect(await codeOf(nominate(database, E2E.friendUserId, { roundId: round.id, nomineeId: E2E.thirdUserId, matchId: weekMatchId(0), comment: "não jogou" }))).toBe("match_not_found");
    expect(await codeOf(nominate(database, E2E.friendUserId, { roundId: round.id, nomineeId: E2E.thirdUserId, matchId: thirdMatchId(1), comment: "de novo" }))).toBe("already_nominated");
    // Only the nominator withdraws.
    expect(await codeOf(withdrawNomination(database, E2E.thirdUserId, testerNomination.id))).toBe("not_nominator");
    // After the end of the period (before the cron closes it), nothing is accepted.
    expect(await codeOf(castVote(database, E2E.userId, thirdNomination.id, new Date(round.endsAt.getTime() + 1)))).toBe("closed");
    expect(await database.select({ n: count() }).from(awardVotes).where(eq(awardVotes.roundId, round.id))).toEqual([{ n: 0 }]);
  });

  test("vote, see the count only after voting, change the vote", async ({ browser }) => {
    // Tester votes for Terceiro; his own nomination has no vote button.
    const tester = await as(browser, ONBOARDED_STATE);
    await tester.page.goto(BAGRE);
    await expect(tester.page.getByRole("button", { name: `Votar em ${E2E.gameName}` })).toHaveCount(0);
    await tester.page.getByRole("button", { name: `Votar em ${E2E.thirdName}` }).click();
    await expect(tester.page.getByRole("button", { name: `Seu voto: ${E2E.thirdName}` })).toHaveAttribute("aria-pressed", "true");
    await expect(tester.page.getByText("1 de 3 votou")).toBeVisible();
    await tester.context.close();

    // Parceiro hasn't voted: no count anywhere, not even in the page payload.
    const friend = await as(browser, FRIEND_STATE);
    await friend.page.goto(BAGRE);
    await expect(friend.page.getByText("Vote para ver a contagem", { exact: false })).toBeVisible();
    expect(await friend.page.content()).not.toMatch(/votes\\?"\s*:\s*\d/);
    await friend.page.getByRole("button", { name: `Votar em ${E2E.gameName}` }).click();
    await expect(friend.page.getByRole("button", { name: `Seu voto: ${E2E.gameName}` })).toBeVisible();
    // Changes the vote to Terceiro.
    await friend.page.getByRole("button", { name: `Votar em ${E2E.thirdName}` }).click();
    await expect(friend.page.getByRole("button", { name: `Seu voto: ${E2E.thirdName}` })).toBeVisible();
    await expect(friend.page.getByText("Voto trocado")).toBeVisible();
    await expect(friend.page.getByText("2 de 3 votaram")).toBeVisible();
    await friend.context.close();

    // Terceiro can't vote for himself; votes for Tester.
    const third = await as(browser, THIRD_STATE);
    await third.page.goto(BAGRE);
    await expect(third.page.getByRole("button", { name: `Votar em ${E2E.thirdName}` })).toHaveCount(0);
    await third.page.getByRole("button", { name: `Votar em ${E2E.gameName}` }).click();
    await expect(third.page.getByText("3 de 3 votaram")).toBeVisible();
    await third.context.close();

    const round = (await currentRound())!;
    const votes = await db().select().from(awardVotes).where(eq(awardVotes.roundId, round.id));
    expect(votes).toHaveLength(3); // one per member, the change replaced Parceiro's vote
    const third2 = await nominationOf(E2E.thirdUserId);
    expect(votes.filter((v) => v.nominationId === third2.id)).toHaveLength(2);
  });

  test("closing twice closes once, badges the Bagre and posts one card", async ({ browser }) => {
    const round = (await currentRound())!;
    const id = await groupId();
    const posted: WebhookPayload[] = [];
    const send: Send = async (url, payload) => {
      expect(url).toBe(HOOK);
      posted.push(payload);
      return { messageId: `msg-${posted.length}` };
    };
    const after = () => new Date(round.endsAt.getTime() + 5 * 60_000);

    const first = await runBagreClosing(db(), { key: serverKey(), now: after, send, onlyGroups: [id], appUrl: "https://retake.example" });
    expect(first).toMatchObject({ closed: 1, outcomes: { winner: 1 }, sent: 1, failed: 0 });
    const second = await runBagreClosing(db(), { key: serverKey(), now: after, send, onlyGroups: [id], appUrl: "https://retake.example" });
    expect(second).toMatchObject({ closed: 0, sent: 0, failed: 0 });
    expect(posted).toHaveLength(1);

    const embed = posted[0]!.embeds[0]!;
    expect(embed.title).toBe(`🐟 ${E2E.thirdName} é o Bagre da Semana`);
    expect(embed.description).toContain("Cinco abates em 17 rounds e um smoke no próprio pé");
    expect(embed.fields?.find((f) => f.name === "A partida")?.value).toMatch(/\[Ver partida\]\(https:\/\/retake\.example\/match\/e2e-match-t\d\)/);
    expect(embed.fields?.find((f) => f.name === "Votos")?.value).toBe("2 votos de 3");
    expect(posted[0]!.allowed_mentions).toEqual({ parse: [] });

    const [closed] = await db().select().from(awardRounds).where(eq(awardRounds.id, round.id));
    expect(closed).toMatchObject({ status: "closed", outcome: "winner", winnerUserId: E2E.thirdUserId, announceStatus: "sent", messageId: "msg-1", announceAttempts: 1 });
    expect(await db().select({ n: count() }).from(awardRounds).where(eq(awardRounds.groupId, id))).toEqual([{ n: 2 }]);

    // Votes after closing are refused.
    const nomination = await nominationOf(E2E.userId);
    expect(await codeOf(castVote(db(), E2E.thirdUserId, nomination.id))).toBe("closed");

    // The badge shows on the Bagre screen, the group's member list and the member profile.
    const { context, page } = await as(browser, ONBOARDED_STATE);
    await page.goto(BAGRE);
    await expect(page.getByRole("region", { name: /Resultado/ }).getByRole("paragraph").filter({ hasText: new RegExp(`^${E2E.thirdName}$`) })).toBeVisible();
    await page.goto(`/groups/${E2E.bagreSlug}`);
    const members = page.getByRole("region", { name: "Membros" });
    await expect(members.getByRole("listitem").filter({ hasText: E2E.thirdName }).getByText("Bagre da Semana")).toBeVisible();
    await page.goto(`/groups/${E2E.bagreSlug}/members/${E2E.thirdUserId}`);
    await expect(page.getByText("Bagre da Semana")).toBeVisible();
    await context.close();
  });
});

test.describe("bagre on a phone", () => {
  test.skip(({ isMobile }) => !isMobile, "390px layout check");
  test.use({ storageState: THIRD_STATE });

  test("fits 390px without sideways scroll", async ({ page }) => {
    await page.goto(BAGRE);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await noHorizontalScroll(page);
  });
});
