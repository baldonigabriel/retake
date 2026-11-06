/**
 * Phase 5 (post-MVP): insights on /me, personal goals, the 1x1 comparison.
 *
 * Seed (e2e/support/seed.ts): Tester has 27 competitive matches (enough for
 * insights); Parceiro has 7 (below the minimum); Vazio has none and is not
 * in "Esquadrão E2E".
 */
import { expect, test, type Page } from "@playwright/test";

import { FRIEND_STATE, ONBOARDED_STATE } from "./global-setup";

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
