import { expect, test } from "@playwright/test";

test.describe("/design-system", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/design-system");
  });

  test("renders every section", async ({ page }) => {
    await expect(page.getByRole("heading", { level: 1, name: "Design system" })).toBeVisible();
    for (const name of ["Cores", "Tipografia", "Forma e elevação", "Ações e campos", "Desempenho", "Partidas", "Grupo", "Estados"]) {
      await expect(page.getByRole("heading", { level: 2, name })).toBeAttached();
    }
  });

  test("has no horizontal page scroll", async ({ page }) => {
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("uses at most one chamfered card", async ({ page }) => {
    await expect(page.locator("[data-slot=chamfer-card]")).toHaveCount(1);
  });

  test("shows a toast", async ({ page }) => {
    await page.getByRole("button", { name: "Mostrar toast de sucesso" }).click();
    await expect(page.getByText("Sincronização concluída")).toBeVisible();
  });

  test("shows the Riot non-affiliation notice", async ({ page }) => {
    await expect(page.getByText(/isn't endorsed by Riot Games/)).toBeAttached();
  });

  test("touch targets are at least 44px on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main button, nav a, [data-slot=button]")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ text: el.textContent?.trim() ?? el.getAttribute("aria-label"), h: el.getBoundingClientRect().height }))
        .filter((b) => b.h < 44),
    );
    expect(small).toEqual([]);
  });
});
