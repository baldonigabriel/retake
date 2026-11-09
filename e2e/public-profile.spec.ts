/**
 * Phase 8 — opt-in public profiles (SPEC §6).
 *
 * Seed (e2e/support/seed.ts): Parceiro is public with rank, agents and
 * matches only; Maratona is public with everything and played against
 * Tester (no shared group); Tester and Terceiro chose private; "Jogador N"
 * players are not Retake users; Vazio and Vitrine never answered.
 */
import { expect, test, type Page } from "@playwright/test";

import { EMPTY_STATE, ONBOARDED_STATE, SHOWCASE_STATE } from "./global-setup";
import { E2E, PUBLIC_RIVAL_MATCH, matchId } from "./support/seed";

const profile = (name: string, tag: string = E2E.tagLine) => `/u/${encodeURIComponent(`${name}-${tag}`)}`;
const NOT_FOUND = "Perfil não encontrado";
const NO_RESULTS = "Nenhum perfil público com esse nome";

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

/**
 * The visible 404 copy is the same for every kind of "no", and the tab title
 * comes from the address only. (The page streams behind loading.tsx, so the
 * HTTP status may be 200; what matters is that nothing tells them apart.)
 */
async function expectNotFound(page: Page, path: string) {
  const response = await page.goto(path);
  expect([200, 404]).toContain(response?.status());
  await expect(page.locator("main").getByText(NOT_FOUND, { exact: true })).toBeVisible();
  return (await page.locator("main").innerText()).trim();
}

test.describe("visitor (signed out)", () => {
  test("finds a public profile through the search and sees only the chosen sections", async ({ page }) => {
    await page.goto("/search?q=parc");
    const results = page.locator("section", { has: page.getByRole("heading", { name: "Perfis públicos" }) });
    await expect(results.getByRole("link")).toHaveCount(1);
    await results.getByRole("link", { name: /Parceiro/ }).click();
    await expect(page).toHaveURL(new RegExp(`${profile(E2E.friendName)}$`));

    await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E.friendName);
    await expect(page.getByText("Rank competitivo")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agentes" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Últimas partidas" })).toBeVisible();
    // Overview, maps and weapons were left out by Parceiro.
    await expect(page.getByRole("heading", { name: "Tendência" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Por mapa" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Armas", exact: true })).toHaveCount(0);
    // Never on a public profile: groups, Bagre, duos, goals, session.
    for (const text of [E2E.groupName, E2E.bagreName, "Bagre", "Com quem você joga melhor", "Metas", "Sessão de hoje"]) {
      await expect(page.getByText(text, { exact: false })).toHaveCount(0);
    }
    // A visitor played none of these matches: no row opens the scoreboard.
    const history = page.locator("section", { has: page.getByRole("heading", { name: "Últimas partidas" }) });
    await expect(history.locator('a[href^="/match/"]')).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Entre no Retake" })).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await noHorizontalScroll(page);
  });

  test("private, non-user and unknown Riot IDs get the same not-found answer", async ({ page }) => {
    const privateUser = await expectNotFound(page, profile(E2E.thirdName));
    const nonUser = await expectNotFound(page, profile("Jogador 7", "XYZ"));
    const unknown = await expectNotFound(page, profile("Ninguem Existe", "ZZZ"));
    const malformed = await expectNotFound(page, "/u/sem-tag-valida!");
    expect(new Set([privateUser, nonUser, unknown, malformed]).size).toBe(1);

    for (const q of [E2E.thirdName, "Jogador 7", "Ninguem Existe", E2E.gameName]) {
      await page.goto(`/search?q=${encodeURIComponent(q)}`);
      await expect(page.getByText(NO_RESULTS)).toBeVisible();
    }
  });

  test("search ignores case and accents, takes #TAG and needs 3 letters", async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent("MÁRATONA#e2")}`);
    await expect(page.getByRole("link", { name: /Maratona/ })).toHaveAttribute("href", profile(E2E.sessionName));
    await page.goto("/search?q=ma");
    await expect(page.getByText("Digite pelo menos 3 letras do nome")).toBeVisible();
  });

  test("suggests public profiles while typing, from the 3rd letter", async ({ page }) => {
    await page.goto("/search");
    const field = page.getByRole("combobox", { name: "Buscar perfil público", exact: true });
    await field.pressSequentially("Pa");
    await expect(page.getByRole("listbox")).toBeHidden();
    await field.pressSequentially("r");
    const list = page.getByRole("listbox", { name: "Perfis públicos encontrados" });
    await expect(list.getByRole("option", { name: /Parceiro/ })).toBeVisible();
    // A private user never shows up as a suggestion either.
    await field.fill("");
    await field.pressSequentially(E2E.thirdName.slice(0, 6));
    await expect(list.getByText("Nenhum perfil público com esse nome.")).toBeVisible();
    // Keyboard: ↓ + Enter opens the profile.
    await field.fill("");
    await field.pressSequentially("Parc");
    await expect(list.getByRole("option", { name: /Parceiro/ })).toBeVisible();
    await field.press("ArrowDown");
    await field.press("Enter");
    await expect(page).toHaveURL(new RegExp(`${profile(E2E.friendName)}$`));
  });

  test("the landing has the profile search", async ({ page }) => {
    await page.goto("/");
    const field = page.getByRole("combobox", { name: "Buscar perfil público", exact: true });
    await field.fill("Parceiro");
    await field.press("Enter");
    await expect(page).toHaveURL(/\/search\?q=Parceiro/);
    await expect(page.getByRole("link", { name: /Parceiro/ }).last()).toBeVisible();
  });
});

test.describe("signed-in viewer", () => {
  test.use({ storageState: ONBOARDED_STATE });

  test("scoreboard links mates to the member profile, public players to /u, nobody else", async ({ page }) => {
    await page.goto(`/match/${matchId(1)}`);
    await expect(page.getByRole("link", { name: E2E.friendName, exact: true })).toHaveAttribute(
      "href",
      new RegExp(`/groups/[^/]+/members/${E2E.friendUserId}$`),
    );

    await page.goto(`/match/${matchId(PUBLIC_RIVAL_MATCH)}`);
    await expect(page.getByRole("link", { name: E2E.sessionName, exact: true })).toHaveAttribute("href", profile(E2E.sessionName));
    // Non-users and the viewer stay plain text.
    await expect(page.getByRole("link", { name: /^Jogador/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: E2E.gameName, exact: true })).toHaveCount(0);
  });

  test("a public profile opens every match's scoreboard, seen from the owner's side", async ({ page }) => {
    await page.goto(profile(E2E.sessionName));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E.sessionName);
    await expect(page.getByRole("heading", { name: "Por mapa" })).toBeVisible();
    const history = page.locator("section", { has: page.getByRole("heading", { name: "Últimas partidas" }) });
    const links = history.locator('a[href^="/match/"]');
    expect(await links.count()).toBeGreaterThan(1);
    for (const href of await links.evaluateAll((as) => as.map((a) => a.getAttribute("href")))) expect(href).toMatch(/\?as=/);

    // A match the viewer didn't play opens from the owner's side.
    const other = history.locator(`a[href^="/match/"]:not([href^="/match/${matchId(PUBLIC_RIVAL_MATCH)}?"])`).first();
    await other.click();
    await expect(page.getByText(`Partida vista pelo lado de ${E2E.sessionName}`)).toBeVisible();
  });

  test("the user's own private profile is not found either", async ({ page }) => {
    await expectNotFound(page, profile(E2E.gameName));
  });
});

test.describe("undecided user", () => {
  test.use({ storageState: EMPTY_STATE });

  test("sees the question once on /me and can put it off", async ({ page }) => {
    await page.goto("/me");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Seu perfil pode ser público?" }) });
    await expect(card).toBeVisible();
    // Nothing pre-selected; the save waits for an answer.
    await expect(card.getByRole("radio")).toHaveCount(2);
    for (const radio of await card.getByRole("radio").all()) await expect(radio).not.toBeChecked();
    await expect(card.getByRole("button", { name: "Salvar escolha" })).toBeDisabled();

    await card.getByRole("button", { name: "Agora não" }).click();
    await expect(card).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Seu perfil pode ser público?" })).toHaveCount(0);
    await expectNotFound(page, profile("Vazio"));
  });
});

test.describe("going public and back to private", () => {
  test.use({ storageState: SHOWCASE_STATE });
  test.describe.configure({ mode: "serial" });

  test("takes effect at once for visitors and the search", async ({ page, browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-1440", "writes Vitrine's settings: one project only");
    const visitor = await browser.newPage({ storageState: { cookies: [], origins: [] } });
    const path = profile(E2E.showcaseName);

    // Before answering: private.
    await expectNotFound(visitor, path);

    await page.goto("/me");
    const card = page.locator("section", { has: page.getByRole("heading", { name: "Seu perfil pode ser público?" }) });
    await card.getByText("Público", { exact: true }).click();
    await card.getByRole("checkbox", { name: /^Mapas/ }).uncheck({ force: true });
    await card.getByRole("button", { name: "Salvar escolha" }).click();
    await expect(page.getByRole("heading", { name: "Seu perfil pode ser público?" })).toHaveCount(0);

    await visitor.goto(path);
    await expect(visitor.getByRole("heading", { level: 1 })).toContainText(E2E.showcaseName);
    await expect(visitor.getByText("Ainda não temos partidas de Vitrine")).toBeVisible();
    await visitor.goto(`/search?q=${E2E.showcaseName}`);
    await expect(visitor.getByRole("link", { name: /Vitrine/ })).toBeVisible();

    // Back to private in Ajustes: gone right away, same answer as a name that doesn't exist.
    await page.goto("/settings");
    const section = page.locator("#perfil");
    await expect(section.getByRole("link", { name: "Ver como visitante" })).toHaveAttribute("href", path);
    await section.getByText("Privado", { exact: true }).click();
    await section.getByRole("button", { name: "Salvar escolha" }).click();
    await expect(section.getByText("Salvo. Seu perfil está privado.")).toBeVisible();

    await expectNotFound(visitor, path);
    await visitor.goto(`/search?q=${E2E.showcaseName}`);
    await expect(visitor.getByText(NO_RESULTS)).toBeVisible();

    // Public with every section unchecked is private too, and the screen says so.
    await page.reload();
    await section.getByText("Público", { exact: true }).click();
    for (const label of ["Rank e RR", "Visão geral", "Agentes", "Armas", "Últimas partidas"]) {
      await section.getByRole("checkbox", { name: new RegExp(`^${label}`) }).uncheck({ force: true });
    }
    await expect(section.getByText("Sem nenhuma seção marcada, seu perfil fica privado.")).toBeVisible();
    await section.getByRole("button", { name: "Salvar escolha" }).click();
    await expect(section.getByText("Salvo. Seu perfil está privado.")).toBeVisible();
    await expectNotFound(visitor, path);
    await visitor.close();
  });
});
