/**
 * Agents, match history, RR per match and member profiles.
 *
 * Seed (e2e/support/seed.ts): Tester has competitive matches in two acts
 * (V26 · Ato VI and Ato V), RR linked to every competitive match except
 * matchId(NO_RR_MATCH), and plays in "Esquadrão E2E" with Parceiro (a Retake
 * user without RR history). Vazio is the outsider.
 */
import { expect, test, type Page } from "@playwright/test";

import { EMPTY_STATE, ONBOARDED_STATE } from "./global-setup";
import { E2E, NO_RR_MATCH, matchId, weekMatchId } from "./support/seed";

const PROFILE = `/groups/${E2E.groupSlug}/members/${E2E.friendUserId}`;

/** Under load a click can land before hydration and be lost: retry until the URL follows. */
async function untilUrl(page: Page, act: () => Promise<unknown>, url: RegExp) {
  await expect(async () => {
    await act();
    await expect(page).toHaveURL(url, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
}

async function noHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe("signed in", () => {
  test.use({ storageState: ONBOARDED_STATE });

  test("the agents section lists agents by matches, with a season filter and highlighted bests", async ({ page, isMobile }) => {
    await page.goto("/me?tab=agents");
    const section = page.locator("section[aria-labelledby=agents-title]");
    await expect(section.getByText("Competitivo · todas as temporadas")).toBeVisible();
    if (isMobile) {
      // Cards with the rest of the numbers behind a disclosure.
      const card = section.getByRole("listitem").first();
      await expect(card).toContainText("Jett");
      await card.getByText("Mais números").click();
      await expect(card.getByText("Melhor mapa")).toBeVisible();
    } else {
      const rows = section.locator("tbody tr");
      await expect(rows.first()).toContainText("Jett");
      await expect(section.getByText("(melhor)").first()).toBeAttached();
      await expect(section.locator("thead")).toContainText("DDΔ");
    }

    // The older act (its name comes from the community catalog, with a date fallback).
    const older = section.getByRole("group", { name: "Temporada" }).getByRole("button").last();
    const name = (await older.textContent())!.trim();
    await untilUrl(page, () => older.click(), /season=/);
    await expect(section.getByText(`Competitivo · ${name}`, { exact: true })).toBeVisible();
    await noHorizontalScroll(page);
  });

  test("an agent page shows evolution, maps and its matches; an agent never played is a 404", async ({ page }) => {
    await page.goto("/me/agents/jett");
    await expect(page.getByRole("heading", { level: 1, name: "Jett" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Evolução com Jett" })).toBeVisible();
    await expect(page.getByRole("table", { name: "Desempenho com o agente por mapa" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Partidas com Jett" }).getByRole("link").first()).toBeVisible();
    await noHorizontalScroll(page);

    await page.goto("/me/agents/neon");
    await expect(page.getByText("Você ainda não jogou com esse agente")).toBeVisible();
  });

  test("the match history groups by day, shows RR with sign or '—', filters and loads more", async ({ page }) => {
    await page.goto("/me?tab=matches");
    const list = page.getByRole("list", { name: "Últimas partidas" });
    await expect(list.getByRole("link")).toHaveCount(20);
    await expect(list.getByRole("heading", { level: 3 }).first()).toBeVisible();
    // RR in words: a sign and "RR"; the match without RR says so.
    await expect(list.getByRole("link").filter({ hasText: /[+−]\d+\s*RR/ }).first()).toBeVisible();

    await page.getByRole("button", { name: /Carregar mais \(7 restantes\)/ }).click();
    await expect(list.getByRole("link")).toHaveCount(27, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /Carregar mais/ })).toHaveCount(0);
    await expect(page.locator(`a[href="/match/${matchId(NO_RR_MATCH)}"]`)).toHaveAttribute("aria-label", /RR indisponível/);

    await untilUrl(page, () => page.getByLabel("Filtrar por agente").selectOption("sage"), /agent=sage/);
    await expect(page).not.toHaveURL(/show=/);
    for (const label of await list.getByRole("link").evaluateAll((els) => els.map((e) => e.getAttribute("aria-label")))) {
      expect(label).toContain("Sage");
    }
  });

  test("the match page shows every player's rank and RR only for Retake users", async ({ page }) => {
    await page.goto(`/match/${weekMatchId(2)}`);
    const mine = page.locator("tr[aria-current=true]");
    await expect(mine).toContainText(/[+−]\d+\s*RR/);
    // Parceiro uses Retake but has no RR for this match: "—", never an estimate.
    const friend = page.locator("tr", { hasText: E2E.friendName });
    await expect(friend.getByText("RR indisponível")).toBeAttached();
    // Players who aren't users: a rank, no RR and no link.
    const stranger = page.locator("tbody tr").filter({ hasText: "Jogador 2" }).first();
    await expect(stranger.getByRole("img", { name: /Platina|Diamante|Ouro|Prata|Bronze|Ferro|Ascendente|Imortal|Radiante/ }).first()).toBeAttached();
    await expect(stranger).not.toContainText("RR");
    await expect(stranger.getByRole("link")).toHaveCount(0);
  });

  test("a member's profile shows their agents and matches; non-members of the group are a 404", async ({ page }) => {
    await page.goto(`/groups/${E2E.groupSlug}`);
    await page.getByRole("link", { name: `Ver perfil de ${E2E.friendName}` }).click();
    await expect(page).toHaveURL(new RegExp(`${PROFILE}$`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(E2E.friendName);
    await expect(page.locator("section[aria-labelledby=agents-title]")).toBeVisible();
    await expect(page.getByRole("list", { name: "Últimas partidas" }).getByRole("link").first()).toBeVisible();

    // Someone who isn't in this group, and a made-up id: same 404.
    for (const id of [E2E.emptyUserId, "nao-existe"]) {
      await page.goto(`/groups/${E2E.groupSlug}/members/${id}`);
      await expect(page.getByText("Perfil não encontrado")).toBeVisible();
    }
    // Your own profile is your dashboard.
    await page.goto(`/groups/${E2E.groupSlug}/members/${E2E.userId}`);
    await expect(page).toHaveURL(/\/me$/);
  });
});

test.describe("outsider", () => {
  test.use({ storageState: EMPTY_STATE });

  test("can't open a member's profile in a group they're not in", async ({ page }) => {
    await page.goto(PROFILE);
    await expect(page.getByText("Perfil não encontrado")).toBeVisible();
    const html = await page.content();
    expect(html).not.toContain(E2E.friendName);
    expect(html).not.toContain(E2E.friendPuuid);
    expect(html).not.toContain(E2E.groupName);
  });
});
