/**
 * Main flow: sign-in guard → onboarding → dashboard → match page, plus the
 * cron guard. Sessions are seeded by global-setup (Discord OAuth can't be
 * automated); HenrikDev is never called from these tests.
 */
import { expect, test, type Page } from "@playwright/test";

import { EMPTY_STATE, FRESH_STATE, ONBOARDED_STATE } from "./global-setup";
import { E2E } from "./support/seed";

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("signed out", () => {
  test("app routes redirect to /login, keeping where to go next", async ({ page }) => {
    await page.goto("/match/abc");
    await expect(page).toHaveURL(/\/login\?next=%2Fmatch%2Fabc$/);
    await page.goto("/me");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Entrar no Retake" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar com Discord" })).toBeEnabled();
  });

  test("the landing leads to login", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Entrar com Discord" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("an OAuth error is explained", async ({ page }) => {
    await page.goto("/login?error=access_denied");
    await expect(page.getByText("Você cancelou o login no Discord", { exact: false })).toBeVisible();
  });
});

test.describe("cron route", () => {
  test("rejects requests without the right bearer secret", async ({ request }) => {
    expect((await request.post("/api/cron/sync")).status()).toBe(401);
    expect((await request.post("/api/cron/sync", { headers: { Authorization: "Bearer wrong" } })).status()).toBe(401);
    expect((await request.get("/api/cron/sync")).status()).toBe(405);
  });
});

test.describe("new user", () => {
  test.use({ storageState: FRESH_STATE });

  test("is sent to onboarding and gets live Riot ID validation", async ({ page }) => {
    await page.goto("/me");
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole("heading", { level: 1, name: "Vincule seu Riot ID" })).toBeVisible();

    const search = page.getByRole("button", { name: "Buscar conta" });
    await expect(search).toBeDisabled();

    const name = page.getByPlaceholder("Nome");
    // Typed right away, possibly before hydration: the form must still pick it up.
    await name.fill("ab");
    await expect(page.getByText("O nome tem pelo menos 3 caracteres.")).toBeVisible();

    // Pasting the full Riot ID splits name and tag.
    await name.fill("Jogador Teste#BR1");
    await expect(name).toHaveValue("Jogador Teste");
    await expect(page.getByLabel("Tag")).toHaveValue("BR1");
    await expect(page.getByText("Formato certo.")).toBeVisible();
    await expect(search).toBeEnabled();
  });
});

test.describe("onboarded user", () => {
  test.use({ storageState: ONBOARDED_STATE });

  test("skips onboarding", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/me$/);
  });

  test("dashboard answers 'am I improving?' for competitive by default", async ({ page }) => {
    await page.goto("/me");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E.gameName);
    await expect(page.getByText(/últimas 20 é \d+/)).toBeVisible();
    await expect(page.getByText("Rank competitivo")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Últimas 20 partidas · Competitivo/ })).toBeVisible();
    for (const kpi of ["ACS", "K/D", "HS%", "ADR", "Vitórias"]) {
      await expect(page.locator("p", { hasText: new RegExp(`^${kpi.replace("/", "\\/")}`) }).first()).toBeVisible();
    }
    await expect(page.getByRole("heading", { name: "Por agente" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Por mapa" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Partidas recentes" }).getByRole("link")).toHaveCount(10);
    await expect(page.locator("[data-slot=chamfer-card]")).toHaveCount(1);
    await noHorizontalScroll(page);
  });

  test("mode and period filters live in the URL and never mix modes silently", async ({ page }) => {
    await page.goto("/me");
    await page.getByRole("group", { name: "Modo" }).getByRole("button", { name: "Sem classificação" }).click();
    await expect(page).toHaveURL(/mode=unrated/);
    await expect(page.getByRole("heading", { name: /2 partidas · Sem classificação/ })).toBeVisible();

    await page.getByRole("group", { name: "Período" }).getByRole("button", { name: "30 dias" }).click();
    await expect(page).toHaveURL(/period=30d/);
    await expect(page.getByText("Nenhuma partida sem classificação nos últimos 30 dias")).toBeVisible();

    await page.goto("/me?mode=all");
    await expect(page.getByText("Médias misturam todos os modos")).toBeVisible();
  });

  test("a match opens with the full scoreboard and the user's row highlighted", async ({ page }) => {
    await page.goto("/me");
    await page.getByRole("list", { name: "Partidas recentes" }).getByRole("link").first().click();
    // The newest match is a seeded group match of this week (or match 0 right after Monday 00:00).
    await expect(page).toHaveURL(new RegExp(`/match/${E2E.matchPrefix}`));

    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Vitória|Derrota|Empate/i);
    await expect(page.getByRole("heading", { name: /^Seu time/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Adversário/ })).toBeVisible();
    await expect(page.getByRole("list", { name: "Partidas recentes" })).toHaveCount(0);
    const boards = page.locator("section[aria-labelledby^=team-]");
    await expect(boards).toHaveCount(2);
    await expect(boards.locator("tbody tr")).toHaveCount(10);

    const you = boards.locator("tr[aria-current=true]");
    await expect(you).toHaveCount(1);
    await expect(you).toContainText(E2E.gameName);

    // Other players appear only here: no links to profiles.
    await expect(boards.locator("a")).toHaveCount(0);
    await noHorizontalScroll(page);
  });

  test("matches the user didn't play are not found", async ({ page }) => {
    await page.goto("/match/not-a-real-match");
    await expect(page.getByText("Partida não encontrada")).toBeVisible();
    await expect(page.getByRole("link", { name: "Voltar ao painel" })).toBeVisible();
  });

  test("touch targets are at least 44px on mobile", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile only");
    await page.goto("/me");
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("main button, main a, nav a, header button")]
        .filter((el) => el.offsetParent !== null)
        .map((el) => ({ text: el.textContent?.trim() || el.getAttribute("aria-label"), h: el.getBoundingClientRect().height }))
        .filter((b) => b.h < 44),
    );
    expect(small).toEqual([]);
  });
});

test.describe("user without matches", () => {
  test.use({ storageState: EMPTY_STATE });

  test("sees an empty dashboard with the next action", async ({ page }) => {
    await page.goto("/me");
    await expect(page.getByText("Ainda não temos partidas suas")).toBeVisible();
    await expect(page.getByText("Sem rank ainda")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sincronizar agora" })).toBeVisible();
  });
});
