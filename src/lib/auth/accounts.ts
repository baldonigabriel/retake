import { and, eq, inArray } from "drizzle-orm";

import type { Database } from "@/db";
import { accounts } from "@/db/schema";

export const LOGIN_PROVIDERS = ["google", "discord"] as const;
export type LoginProvider = (typeof LOGIN_PROVIDERS)[number];
export type LoginAccount = { id: string; provider: LoginProvider; createdAt: Date };
export type UnlinkLoginResult =
  | { ok: true; provider: LoginProvider }
  | { ok: false; reason: "not-found" | "last-account" };

export async function listLoginAccounts(database: Database, userId: string): Promise<LoginAccount[]> {
  const rows = await database
    .select({ id: accounts.id, provider: accounts.providerId, createdAt: accounts.createdAt })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), inArray(accounts.providerId, [...LOGIN_PROVIDERS])));
  return rows.flatMap((row) =>
    LOGIN_PROVIDERS.includes(row.provider as LoginProvider)
      ? [{ id: row.id, provider: row.provider as LoginProvider, createdAt: row.createdAt }]
      : [],
  );
}

/** Removes one provider. The database trigger is the final, concurrency-safe guard. */
export async function unlinkLoginAccount(database: Database, userId: string, accountId: string): Promise<UnlinkLoginResult> {
  const linked = await listLoginAccounts(database, userId);
  const target = linked.find((account) => account.id === accountId);
  if (!target) return { ok: false, reason: "not-found" };
  if (linked.length <= 1) return { ok: false, reason: "last-account" };

  try {
    const deleted = await database
      .delete(accounts)
      .where(and(eq(accounts.id, target.id), eq(accounts.userId, userId)))
      .returning({ id: accounts.id });
    return deleted.length === 1 ? { ok: true, provider: target.provider } : { ok: false, reason: "not-found" };
  } catch (error) {
    if (isLastLoginConstraint(error)) return { ok: false, reason: "last-account" };
    throw error;
  }
}

function isLastLoginConstraint(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: unknown; constraint?: unknown; cause?: unknown };
  if (candidate.code === "23514" && candidate.constraint === "accounts_require_login") return true;
  return candidate.cause ? isLastLoginConstraint(candidate.cause) : false;
}
