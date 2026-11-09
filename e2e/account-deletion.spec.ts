/**
 * "Apagar minha conta" in Ajustes.
 *
 * Seed (e2e/support/seed.ts): Saida owns "Saída E2E" (Herdeiro joined
 * before Caçula, so Herdeiro inherits) and "Solo E2E" (nobody else, so it
 * goes). Saida has a public profile and a rank snapshot. It writes, so it
 * runs in the desktop project only.
 */
import { expect, test } from "@playwright/test";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { groupMembers, groups, mmrSnapshots, riotAccounts, users } from "@/db/schema";

import { LEAVING_STATE } from "./global-setup";
import { E2E } from "./support/seed";

test.use({ storageState: LEAVING_STATE });

test("deleting the account hands groups to the oldest member and removes what is only yours", async ({ page, browser }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-1440", "deletes Saida: one project only");

  await page.goto("/settings");
  const section = page.locator("#apagar-conta");
  await expect(section.getByText(`${E2E.leavingGroupName} passa para ${E2E.heirName}, o membro mais antigo.`)).toBeVisible();
  await expect(section.getByText(`${E2E.soloGroupName} é apagado, porque não tem outros membros.`)).toBeVisible();

  // Cancel first: nothing happens.
  await section.getByRole("button", { name: "Apagar minha conta" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Apagar sua conta do Retake?" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  expect(await db().select({ id: users.id }).from(users).where(eq(users.id, E2E.leavingUserId))).toHaveLength(1);

  await section.getByRole("button", { name: "Apagar minha conta" }).click();
  await dialog.getByRole("button", { name: "Apagar minha conta" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/", { timeout: 15_000 });

  // Signed out: the app sends back to the login.
  await page.goto("/me");
  await expect(page).toHaveURL(/\/login/);

  const database = db();
  expect(await database.select({ id: users.id }).from(users).where(eq(users.id, E2E.leavingUserId))).toHaveLength(0);
  expect(await database.select({ id: riotAccounts.id }).from(riotAccounts).where(eq(riotAccounts.puuid, E2E.leavingPuuid))).toHaveLength(0);
  expect(await database.select({ id: mmrSnapshots.id }).from(mmrSnapshots).where(eq(mmrSnapshots.puuid, E2E.leavingPuuid))).toHaveLength(0);

  const [kept] = await database.select({ id: groups.id, ownerId: groups.ownerId }).from(groups).where(eq(groups.slug, E2E.leavingGroupSlug));
  expect(kept?.ownerId).toBe(E2E.heirUserId);
  const [heir] = await database
    .select({ role: groupMembers.role })
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, kept!.id), eq(groupMembers.userId, E2E.heirUserId)));
  expect(heir?.role).toBe("owner");
  expect(await database.select({ id: groups.id }).from(groups).where(eq(groups.slug, E2E.soloGroupSlug))).toHaveLength(0);

  // The public profile is gone like any name that doesn't exist.
  const visitor = await browser.newPage({ storageState: { cookies: [], origins: [] } });
  await visitor.goto(`/u/${E2E.leavingName}-${E2E.tagLine}`);
  await expect(visitor.locator("main").getByText("Perfil não encontrado", { exact: true })).toBeVisible();
  await visitor.close();
});
