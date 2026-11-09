/**
 * "Sessão de hoje" on /me.
 *
 * Seed (e2e/support/seed.ts): Maratona played 4 competitive matches in the
 * last 3 hours, 10 minutes apart: V, D, D, D (RR +19, −16, −17, and the last
 * one without RR yet). Vazio has no matches at all.
 */
import { expect, test, type Page } from "@playwright/test";

import { EMPTY_STATE, SESSION_STATE } from "./global-setup";
import { sessionMatchId } from "./support/seed";

const sessionCard = (page: Page) => page.locator("section", { has: page.getByRole("heading", { name: "Sessão de hoje" }) });
const STREAMED = { timeout: 15_000 };

test.describe("today's session", () => {
  test.use({ storageState: SESSION_STATE });

  test("sums the session at the top of /me: matches, V–D, known RR, ACS and the best match", async ({ page }) => {
    await page.goto("/me");
    const card = sessionCard(page);
    await expect(card).toBeVisible(STREAMED);
    // It's the first section on the page.
    await expect(page.locator("main section").first()).toHaveAttribute("aria-labelledby", "session-title");
    await expect(card.getByText(/Em andamento · começou às \d\d:\d\d/)).toBeVisible();
    await expect(card.getByText("1 vitórias, 3 derrotas")).toBeAttached();
    await expect(card.getByText("−14")).toBeVisible();
    await expect(card.getByText("1 partida ainda sem RR")).toBeVisible();
    await expect(card.getByRole("list", { name: "Resultados na ordem em que foram jogados" }).getByRole("listitem")).toHaveCount(4);
    const best = card.getByRole("link", { name: /Jett na Ascent/ });
    await expect(best).toHaveAttribute("href", `/match/${sessionMatchId(0)}`);
    await expect(best).toContainText("310");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test("shows the empty duo state when you share no group with another Retake user", async ({ page }) => {
    await page.goto("/me?tab=duos");
    const duos = page.locator("section", { has: page.getByRole("heading", { name: "Com quem você joga melhor" }) });
    await expect(duos.getByText("Nenhum amigo do Retake nos seus grupos ainda")).toBeVisible(STREAMED);
    await expect(duos.getByRole("link", { name: "Ver meus grupos" })).toHaveAttribute("href", "/groups");
  });
});

test.describe("without a session", () => {
  test.use({ storageState: EMPTY_STATE });

  test("doesn't show the card", async ({ page }) => {
    await page.goto("/me");
    await expect(page.getByText("Ainda não temos partidas suas")).toBeVisible();
    await expect(sessionCard(page)).toHaveCount(0);
  });
});

test.describe("break note", () => {
  test.use({ storageState: SESSION_STATE });
  // The settings switch writes Maratona's preference: one project only, in order.
  test.describe.configure({ mode: "serial" });
  test.skip(({ isMobile }) => isMobile, "writes a shared preference; desktop only to avoid racing the mobile run");

  const note = (page: Page) => sessionCard(page).getByRole("status").filter({ hasText: "derrotas seguidas" });

  test("suggests a break after 3 losses in a row, friendly and closable for the session", async ({ page }) => {
    await page.goto("/me");
    await expect(note(page)).toBeVisible(STREAMED);
    await expect(note(page)).toContainText("3 derrotas seguidas. Acontece com todo mundo.");
    await expect(note(page)).toContainText("pausa");

    await note(page).getByRole("button", { name: "Fechar aviso de pausa" }).click();
    await expect(note(page)).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Sessão de hoje" })).toBeFocused();

    // Closed for this session: it doesn't come back on the next visit.
    await page.reload();
    await expect(sessionCard(page)).toBeVisible(STREAMED);
    await expect(note(page)).toHaveCount(0);
  });

  test("can be turned off and on in the settings", async ({ page }) => {
    await page.goto("/me");
    await note(page).getByRole("link", { name: "Desligar este aviso nos ajustes" }).click(STREAMED);
    await expect(page).toHaveURL(/\/settings#break-reminder$/);

    const toggle = page.getByRole("switch", { name: "Aviso de pausa" });
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await expect(page.getByText("Aviso de pausa desligado")).toBeVisible();

    await page.goto("/me");
    await expect(sessionCard(page)).toBeVisible(STREAMED);
    await expect(note(page)).toHaveCount(0);

    await page.goto("/settings");
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(page.getByText("Aviso de pausa ligado")).toBeVisible();
    await page.goto("/me");
    await expect(note(page)).toBeVisible(STREAMED);
  });
});
