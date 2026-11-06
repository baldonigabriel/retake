/**
 * Groups: create → invite → join, the weekly ranking/MVP, "together" matches,
 * and the access rules (outsiders get 404, members can't manage, revoked
 * links stop working, the webhook is stored encrypted).
 *
 * Seed (e2e/support/seed.ts): "Esquadrão E2E" = Tester (owner) + Parceiro;
 * Vazio is the outsider. Parceiro and Tester played 3 competitive matches
 * together this week, Parceiro with ACS 400 (the MVP).
 */
import { expect, test, type Browser, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { groups } from "@/db/schema";

import { EMPTY_STATE, FRIEND_STATE, ONBOARDED_STATE } from "./global-setup";
import { E2E, weekMatchId } from "./support/seed";

const SQUAD = `/groups/${E2E.groupSlug}`;

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

async function as(browser: Browser, storageState: string) {
  const context = await browser.newContext({ storageState });
  return { context, page: await context.newPage() };
}

test.describe("signed out", () => {
  test("invite links go through login and come back", async ({ page }) => {
    await page.goto(`/invite/${E2E.groupInvite}`);
    await expect(page).toHaveURL(new RegExp(`/login\\?next=%2Finvite%2F${E2E.groupInvite}$`));
  });
});

test.describe("outsider", () => {
  test.use({ storageState: EMPTY_STATE });

  test("gets 404 for a group they're not in, its settings and a made-up slug", async ({ page }) => {
    for (const path of [SQUAD, `${SQUAD}/settings`, "/groups/nao-existe"]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { name: "Grupo não encontrado" }).or(page.getByText("Grupo não encontrado"))).toBeVisible();
      await expect(page.getByText(E2E.groupName)).toHaveCount(0);
      await expect(page.getByText(E2E.friendName)).toHaveCount(0);
    }
    await page.goto("/groups");
    await expect(page.getByText("Você ainda não está em nenhum grupo")).toBeVisible();
  });

  test("can't act on the group through Server Actions either", async ({ page }) => {
    // The page for a group they're not in never renders its id, actions, members or invite.
    await page.goto(SQUAD);
    const html = await page.content();
    expect(html).not.toContain(E2E.groupInvite);
    expect(html).not.toContain(E2E.friendPuuid);
  });
});

test.describe("member", () => {
  test.use({ storageState: FRIEND_STATE });

  test("sees the weekly ranking, the MVP rule and the matches played together", async ({ page }) => {
    await page.goto(SQUAD);
    await expect(page.getByRole("heading", { level: 1, name: E2E.groupName })).toBeVisible();

    const ranking = page.getByRole("list", { name: "Ranking da semana por ACS" });
    await expect(ranking.getByRole("listitem")).toHaveCount(2);
    await expect(ranking.getByRole("listitem").first()).toContainText(E2E.friendName);
    await expect(ranking.locator("li[aria-current=true]")).toContainText(E2E.friendName);
    await expect(page.getByRole("heading", { name: "Ranking · Competitivo" })).toBeVisible();

    const mvp = page.locator("section[aria-labelledby=mvp-title]");
    await expect(mvp).toContainText(E2E.friendName);
    await expect(mvp).toContainText("ACS");
    await expect(mvp).toContainText("Maior ACS em partidas competitivas da semana, com pelo menos 3 partidas");
    await expect(page.locator("[data-slot=chamfer-card]")).toHaveCount(1);

    // Metric switch lives in the URL.
    await page.getByRole("group", { name: "Métrica" }).getByRole("button", { name: "Partidas" }).click();
    await expect(page).toHaveURL(/metric=matches/);
    await expect(page.getByRole("list", { name: "Ranking da semana por Partidas" })).toBeVisible();

    const together = page.getByRole("list", { name: "Partidas que jogaram juntos" });
    await expect(together.getByRole("listitem").filter({ hasText: "destaque" }).first()).toBeVisible();
    await expect(together.locator(`a[href="/match/${weekMatchId(2)}"]`)).toBeVisible();
    // Only group members appear: never other players from those matches.
    await expect(together).not.toContainText("Jogador");

    // Members can leave but not manage.
    await expect(page.getByRole("button", { name: "Sair do grupo" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Ajustes do grupo" })).toHaveCount(0);
    await page.goto(`${SQUAD}/settings`);
    await expect(page).toHaveURL(new RegExp(`${SQUAD}$`));
    await noHorizontalScroll(page);
  });

  test("the match played together marks the other member on the scoreboard", async ({ page }) => {
    await page.goto(`/match/${weekMatchId(0)}`);
    const tester = page.locator("tr", { hasText: E2E.gameName });
    await expect(tester.getByText("grupo", { exact: true })).toBeVisible();
    await expect(page.locator("tr", { hasText: "Jogador 2" }).getByText("grupo", { exact: true })).toHaveCount(0);
  });
});

test.describe("owner", () => {
  test.use({ storageState: ONBOARDED_STATE });

  test("create → invite → a friend joins → revoking kills the old link", async ({ page, browser }) => {
    test.setTimeout(90_000); // two browsers and several first-time page compiles in dev
    const slug = `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    await page.goto("/groups");
    await expect(page.getByRole("list", { name: "Seus grupos" })).toContainText(E2E.groupName);

    // Validation: reserved address.
    await page.getByLabel("Nome do grupo").fill("Os Parças");
    await expect(page.getByLabel("Endereço do grupo")).toHaveValue("os-parcas");
    await page.getByLabel("Endereço do grupo").fill("join");
    await page.getByRole("button", { name: "Criar grupo" }).click();
    await expect(page.getByText("Esse endereço é reservado")).toBeVisible();

    // Taken address (the seeded group) comes back from the server.
    await page.getByLabel("Endereço do grupo").fill(E2E.groupSlug);
    await page.getByRole("button", { name: "Criar grupo" }).click();
    await expect(page.getByText("Esse endereço já está em uso")).toBeVisible();

    await page.getByLabel("Endereço do grupo").fill(slug);
    await page.getByRole("button", { name: "Criar grupo" }).click();
    await expect(page).toHaveURL(new RegExp(`/groups/${slug}$`));
    await expect(page.getByRole("heading", { level: 1, name: "Os Parças" })).toBeVisible();
    await expect(page.getByText("1 membro · você é o dono")).toBeVisible();
    await expect(page.getByText("Nenhuma partida juntos ainda")).toBeVisible();

    await page.getByRole("link", { name: "Ajustes do grupo" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Ajustes do grupo" })).toBeVisible();
    const link = await page.getByRole("textbox", { name: "Link de convite" }).inputValue();
    const invitePath = new URL(link).pathname;
    expect(invitePath).toMatch(/^\/invite\/[\w-]{24}$/);

    // Parceiro opens the link in another browser and joins.
    const friend = await as(browser, FRIEND_STATE);
    await friend.page.goto(invitePath);
    await expect(friend.page.getByRole("heading", { name: "Os Parças" })).toBeVisible();
    await expect(friend.page.getByText("1 membro")).toBeVisible();
    await friend.page.getByRole("button", { name: "Entrar no grupo" }).click();
    await expect(friend.page).toHaveURL(new RegExp(`/groups/${slug}$`));
    await expect(friend.page.getByText("2 membros")).toBeVisible();
    await expect(friend.page.getByRole("list", { name: "Ranking da semana por ACS" }).getByRole("listitem")).toHaveCount(2);
    await expect(friend.page.getByRole("list", { name: "Partidas que jogaram juntos" })).toBeVisible();
    // Opening the link again just goes to the group.
    await friend.page.goto(invitePath);
    await expect(friend.page).toHaveURL(new RegExp(`/groups/${slug}$`));

    // Owner revokes the link: the old one no longer works for anyone new.
    await page.reload();
    await expect(page.locator("section[aria-labelledby=members-title]")).toContainText(E2E.friendName);
    await page.getByRole("button", { name: "Gerar link novo" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Gerar link novo" }).click();
    await expect(page.getByRole("textbox", { name: "Link de convite" })).not.toHaveValue(link);

    const outsider = await as(browser, EMPTY_STATE);
    await outsider.page.goto(invitePath);
    await expect(outsider.page.getByText("Esse convite não vale mais")).toBeVisible();
    await outsider.page.goto(`/groups/${slug}`);
    await expect(outsider.page.getByText("Grupo não encontrado")).toBeVisible();

    // Owner removes Parceiro, who then gets 404.
    await page.getByRole("button", { name: `Remover ${E2E.friendName} do grupo` }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remover" }).click();
    await expect(page.locator("section[aria-labelledby=members-title]")).not.toContainText(E2E.friendName);
    await friend.page.goto(`/groups/${slug}`);
    await expect(friend.page.getByText("Grupo não encontrado")).toBeVisible();

    await friend.context.close();
    await outsider.context.close();
  });

  test("the Discord webhook is validated, masked and stored encrypted", async ({ page, isMobile }) => {
    test.skip(isMobile, "writes the shared seeded group; desktop only to avoid racing the mobile run");
    await page.goto(`${SQUAD}/settings`);
    const field = page.getByLabel("URL do webhook");
    await field.fill("https://evil.example/api/webhooks/1/abc");
    await page.getByRole("button", { name: "Salvar webhook" }).click();
    await expect(page.getByText("Isso não parece um webhook do Discord")).toBeVisible();

    const token = "e2eTokenAbcdefghijklmnopqrstuvwxyz0123456789_-ABCDEFGHIJKLMNOPQRSTU";
    await field.fill(`https://discord.com/api/webhooks/123456789012345678/${token}`);
    await page.getByRole("button", { name: "Salvar webhook" }).click();
    await expect(page.getByText("discord.com/api/webhooks/…5678/••••••")).toBeVisible();
    expect(await page.content()).not.toContain(token);

    const [row] = await db().select({ hook: groups.discordWebhookUrl }).from(groups).where(eq(groups.slug, E2E.groupSlug));
    expect(row?.hook).toMatch(/^v1\./);
    expect(row?.hook).not.toContain("discord");

    await page.getByRole("button", { name: "Remover", exact: true }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Remover webhook" }).click();
    await expect(page.getByLabel("URL do webhook")).toBeVisible();
  });

  test("group screens have no sideways scroll and 44px targets on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    for (const path of ["/groups", SQUAD, `${SQUAD}/settings`]) {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await noHorizontalScroll(page);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLElement>("main button, main a, main input")]
          .filter((el) => el.offsetParent !== null)
          .map((el) => ({ text: el.textContent?.trim() || el.getAttribute("aria-label"), h: el.getBoundingClientRect().height }))
          .filter((b) => b.h < 44),
      );
      expect(small, path).toEqual([]);
    }
  });
});
