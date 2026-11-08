import { expect, test } from "@playwright/test";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { accounts, users } from "@/db/schema";
import { assertDevDatabase } from "@/db/dev-guard";
import { listLoginAccounts, unlinkLoginAccount } from "@/lib/auth/accounts";

const USER_ID = "e2e-auth-accounts-user";

test.skip(({ isMobile }) => isMobile, "database invariant runs once in the desktop project");
test.describe.configure({ mode: "serial" });

test.beforeEach(async () => {
  await assertDevDatabase();
  await db().delete(users).where(eq(users.id, USER_ID));
  await db().insert(users).values({
    id: USER_ID,
    name: "Login Test",
    email: "e2e-auth-accounts@retake.example",
    emailVerified: true,
  });
  await db().insert(accounts).values([
    { id: `${USER_ID}-google`, accountId: `${USER_ID}-google`, providerId: "google", userId: USER_ID },
    { id: `${USER_ID}-discord`, accountId: `${USER_ID}-discord`, providerId: "discord", userId: USER_ID },
  ]);
});

test.afterEach(async () => {
  await db().delete(users).where(eq(users.id, USER_ID));
});

test("lists both providers and refuses to remove the last login", async () => {
  await expect(listLoginAccounts(db(), USER_ID)).resolves.toHaveLength(2);
  await expect(unlinkLoginAccount(db(), USER_ID, `${USER_ID}-google`)).resolves.toEqual({ ok: true, provider: "google" });
  await expect(unlinkLoginAccount(db(), USER_ID, `${USER_ID}-discord`)).resolves.toEqual({ ok: false, reason: "last-account" });
  await expect(listLoginAccounts(db(), USER_ID)).resolves.toMatchObject([{ provider: "discord" }]);
});

test("two concurrent removals still leave one login", async () => {
  const results = await Promise.all([
    unlinkLoginAccount(db(), USER_ID, `${USER_ID}-google`),
    unlinkLoginAccount(db(), USER_ID, `${USER_ID}-discord`),
  ]);

  expect(results.filter((result) => result.ok)).toHaveLength(1);
  expect(results.filter((result) => !result.ok && result.reason === "last-account")).toHaveLength(1);
  await expect(listLoginAccounts(db(), USER_ID)).resolves.toHaveLength(1);
});
