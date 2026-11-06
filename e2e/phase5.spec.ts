/**
 * Phase 5 (post-MVP): insights on /me, personal goals, the 1x1 comparison.
 *
 * Seed (e2e/support/seed.ts): Tester has 27 competitive matches (enough for
 * insights); Parceiro has 7 (below the minimum); Vazio has none and is not
 * in "Esquadrão E2E".
 */
import { expect, test, type Page } from "@playwright/test";

import { EMPTY_STATE, FRIEND_STATE, ONBOARDED_STATE } from "./global-setup";
import { E2E } from "./support/seed";

const COMPARE = `/groups/${E2E.groupSlug}/compare`;

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("insights", () => {
  test.describe("with enough matches", () => {
    test.use({ storageState: ONBOARDED_STATE });

    test("shows trends in tentative language, with the sample size", async ({ page }) => {
      await page.goto("/me");
      const panel = page.locator("section", { has: page.getByRole("heading", { name: "Tendências" }) });
      await expect(panel).toBeVisible();
      await expect(panel.getByText("Competitivo · 27 partidas")).toBeVisible();
      const items = panel.getByRole("listitem");
      expect(await items.count()).toBeGreaterThan(0);
      for (const text of await items.allInnerTexts()) {
        expect(text).toMatch(/tende|costuma|têm sido/);
        expect(text).toMatch(/\d+ partidas de 27/);
      }
      await expect(panel.getByText("não regras", { exact: false })).toBeVisible();
      await noHorizontalScroll(page);
    });
  });

  test.describe("with few matches", () => {
    test.use({ storageState: FRIEND_STATE });

    test("says how many matches are missing instead of guessing", async ({ page }) => {
      await page.goto("/me");
      const panel = page.locator("section", { has: page.getByRole("heading", { name: "Tendências" }) });
      await expect(panel.getByText(/Faltam \d+ partidas para apontarmos tendências/)).toBeVisible();
      await expect(panel.getByRole("progressbar")).toHaveAttribute("aria-valuemax", "15");
    });
  });
});

test.describe("1x1 comparison", () => {
  test.describe("member", () => {
    test.use({ storageState: ONBOARDED_STATE });

    test("puts the viewer against the other member, with every metric and the matches together", async ({ page }) => {
      await page.goto(`/groups/${E2E.groupSlug}`);
      await page.getByRole("link", { name: "Comparar com Parceiro" }).click();
      await expect(page).toHaveURL((url) => url.pathname === COMPARE && url.searchParams.get("b") === E2E.friendUserId);
      await expect(page.getByRole("heading", { level: 1, name: "Comparação 1x1" })).toBeVisible();
      await expect(page.getByLabel("Jogador 1")).toHaveValue(E2E.userId);
      await expect(page.getByLabel("Jogador 2")).toHaveValue(E2E.friendUserId);
      const card = page.getByRole("region", { name: "Tester contra Parceiro" });
      for (const metric of ["ACS", "K/D", "HS%", "ADR", "Vitórias"]) {
        await expect(card.getByText(metric, { exact: true })).toBeVisible();
      }
      // Parceiro (ACS 400 in the week matches) leads ACS; screen readers hear it.
      await expect(card.getByText(/ACS.*Parceiro na frente/)).toBeAttached();
      await expect(page.getByRole("heading", { name: "No mesmo time" })).toBeVisible();
      await expect(page.getByRole("list", { name: "Partidas que jogaram juntos" }).getByRole("listitem").first()).toBeVisible();
      await noHorizontalScroll(page);
    });

    test("swaps sides and switches period without leaving the page", async ({ page }) => {
      await page.goto(COMPARE);
      await page.getByRole("button", { name: "Trocar os lados" }).click();
      await expect(page.getByLabel("Jogador 1")).toHaveValue(E2E.friendUserId);
      await expect(page.getByRole("region", { name: "Parceiro contra Tester" })).toBeVisible();
      await page.getByRole("button", { name: "Esta semana" }).click();
      await expect(page).toHaveURL(/period=week/);
      await expect(page.getByText("Competitivo · esta semana")).toBeVisible();
    });

    test("ignores ids that aren't comparable members of the group", async ({ page }) => {
      // Vazio is a real user with a Riot account, but not in this group.
      await page.goto(`${COMPARE}?a=${E2E.emptyUserId}&b=${E2E.emptyUserId}`);
      await expect(page.getByRole("region", { name: "Tester contra Parceiro" })).toBeVisible();
      await expect(page.getByText("Vazio")).toHaveCount(0);
    });
  });

  test.describe("outsider", () => {
    test.use({ storageState: EMPTY_STATE });

    test("gets the not-found page, like any other group page", async ({ page }) => {
      await page.goto(`${COMPARE}?a=${E2E.userId}&b=${E2E.friendUserId}`);
      await expect(page.getByText("Grupo não encontrado")).toBeVisible();
      await expect(page.getByText(E2E.friendName)).toHaveCount(0);
    });
  });
});

test.describe("goals", () => {
  // Desktop uses Tester, mobile uses Parceiro: the two projects run in parallel and must not share goals.
  test("create, see progress, update the target and remove with confirmation", async ({ browser, isMobile }) => {
    const context = await browser.newContext({
      storageState: isMobile ? FRIEND_STATE : ONBOARDED_STATE,
      ...(isMobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } }),
    });
    const page = await context.newPage();
    await page.goto("/me");
    const panel = page.locator("section", { has: page.getByRole("heading", { name: "Metas da semana" }) });
    await expect(panel.getByText("Nenhuma meta para esta semana")).toBeVisible();

    await panel.getByRole("button", { name: "Criar meta" }).click();
    await expect(panel.getByLabel("Métrica", { exact: true })).toBeFocused();
    const target = panel.getByRole("textbox", { name: "Acima de" });
    await target.fill("200");
    await panel.getByRole("button", { name: "Salvar meta" }).click();
    await expect(panel.getByText("Use um valor entre 1% e 80%.")).toBeVisible();
    await target.fill("20");
    await panel.getByRole("button", { name: "Salvar meta" }).click();
    await expect(page.getByText("Meta criada: HS% acima de 20%")).toBeVisible();
    await expect(panel.getByRole("progressbar", { name: "Progresso: HS% acima de 20%" })).toBeVisible();
    await expect(panel.getByText(/Batida|Abaixo|Parcial/).first()).toBeVisible();

    // Same metric again: updates the target instead of a second goal.
    await panel.getByRole("button", { name: "Nova meta" }).click();
    await panel.getByLabel("Métrica", { exact: true }).selectOption("hs");
    await expect(panel.getByText("Você já tem essa meta (20%). Salvar troca o alvo.")).toBeVisible();
    await panel.getByRole("textbox", { name: "Acima de" }).fill("22");
    await panel.getByRole("button", { name: "Salvar meta" }).click();
    await expect(page.getByText("Meta atualizada: HS% acima de 22%")).toBeVisible();
    await expect(panel.getByRole("progressbar")).toHaveCount(1);

    await panel.getByRole("button", { name: "Remover meta: HS% acima de 22%" }).click();
    const dialog = page.getByRole("alertdialog", { name: "Remover esta meta?" });
    await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
    await dialog.getByRole("button", { name: "Remover meta" }).click();
    await expect(page.getByText("Meta removida")).toBeVisible();
    await expect(panel.getByText("Nenhuma meta para esta semana")).toBeVisible();
    await noHorizontalScroll(page);
    await context.close();
  });
});
