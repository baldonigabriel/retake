/**
 * "Com quem você joga melhor" on /me and on the group page.
 *
 * Seed (e2e/support/seed.ts): Tester and Parceiro share a team in 7
 * competitive matches (small sample). Terceiro shares a group with Tester but
 * never a match. Every other player in those matches is not a Retake user and
 * must never show up.
 */
import { expect, test, type Page } from "@playwright/test";

import { ONBOARDED_STATE } from "./global-setup";
import { E2E } from "./support/seed";

const duos = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: "Com quem você joga melhor" }) });
/** The section streams in after the page (its own Suspense boundary). */
const STREAMED = { timeout: 15_000 };

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("duo synergy", () => {
  test.use({ storageState: ONBOARDED_STATE });

  test("ranks Retake mates from shared groups, with the trend against your average", async ({ page }) => {
    await page.goto("/me");
    const panel = duos(page);
    await expect(panel).toBeVisible(STREAMED);
    await expect(panel.getByText(/sua média \d+%/)).toBeVisible();
    await expect(panel.getByText(/^Com Parceiro a tendência é de \d+% de vitórias em 7 partidas/)).toBeVisible();

    const rows = panel.getByRole("listitem");
    await expect(rows).toHaveCount(1);
    await expect(rows.first()).toContainText("Parceiro");
    await expect(rows.first()).toContainText("7 partidas juntos");
    await expect(rows.first()).toContainText("amostra pequena");
    // Outsiders (seeded as "Jogador N") and members never on your team stay out.
    await expect(panel.getByText(/Jogador/)).toHaveCount(0);
    await expect(panel.getByText(E2E.thirdName)).toHaveCount(0);
    await expect(panel.getByText("não regra", { exact: false })).toBeVisible();
    await noHorizontalScroll(page);
  });

  test("links to the matches played together, and the filter can be removed", async ({ page }) => {
    await page.goto("/me");
    await duos(page).getByRole("link", { name: /Parceiro.*Ver as partidas/ }).click(STREAMED);
    await expect(page).toHaveURL((url) => url.searchParams.get("with") === E2E.friendUserId);

    const history = page.locator("section", { has: page.getByRole("heading", { name: "Últimas partidas" }) });
    await expect(history.getByText("No mesmo time que")).toBeVisible();
    await expect(history.getByText("7 partidas", { exact: true })).toBeVisible();

    await history.getByRole("link", { name: "Tirar o filtro: partidas com Parceiro" }).click();
    await expect(page).toHaveURL((url) => !url.searchParams.has("with"));
    await expect(history.getByText("No mesmo time que")).toHaveCount(0);
  });

  test("ignores a 'with' that isn't a mate from your groups", async ({ page }) => {
    await page.goto(`/me?with=${encodeURIComponent(E2E.emptyUserId)}`);
    const history = page.locator("section", { has: page.getByRole("heading", { name: "Últimas partidas" }) });
    await expect(history).toBeVisible();
    await expect(history.getByText("No mesmo time que")).toHaveCount(0);
  });

  test("shows the same section on the group page, only with that group's members", async ({ page }) => {
    await page.goto(`/groups/${E2E.groupSlug}`);
    const panel = duos(page);
    await expect(panel.getByRole("listitem")).toHaveCount(1, STREAMED);
    await expect(panel.getByRole("listitem").first()).toContainText("Parceiro");
    await expect(panel.getByRole("link", { name: /Parceiro.*Ver as partidas/ })).toHaveAttribute("href", /\/me\?with=e2e-friend-user/);
    await noHorizontalScroll(page);
  });
});
