/**
 * Linking a Riot account to a Retake user (onboarding).
 *
 * Rules (CLAUDE.md › Privacidade):
 * - one Riot account per user (riot_accounts.user_id is unique);
 * - a puuid already claimed by another user can't be claimed again;
 * - accounts created by sync:once (no owner) can be claimed.
 *
 * Without Riot sign-on we can't prove ownership, so the UI asks the user to
 * confirm the account is theirs before linking.
 */
import { eq, isNull, or } from "drizzle-orm";

import { riotAccounts, type RiotAccount } from "@/db/schema";
import { HenrikApiError, playerCardUrl, type HenrikAccount } from "@/lib/henrik";
import type { SyncDeps } from "@/lib/sync";

export type LinkErrorCode = "not_found" | "claimed" | "already_linked" | "rate_limited" | "unavailable";

export class LinkError extends Error {
  readonly code: LinkErrorCode;
  constructor(code: LinkErrorCode, message?: string) {
    super(message ?? code);
    this.name = "LinkError";
    this.code = code;
  }
}

export interface RiotAccountPreview {
  gameName: string;
  tagLine: string;
  cardUrl: string | null;
  accountLevel: number | null;
}

/** HenrikDev failures → stable codes the UI can explain. */
export function toLinkError(error: unknown): LinkError {
  if (error instanceof LinkError) return error;
  if (error instanceof HenrikApiError) {
    if (error.status === 404) return new LinkError("not_found", error.message);
    if (error.status === 429) return new LinkError("rate_limited", error.message);
  }
  return new LinkError("unavailable", error instanceof Error ? error.message : String(error));
}

async function lookup(deps: SyncDeps, riotId: { gameName: string; tagLine: string }): Promise<HenrikAccount> {
  try {
    return await deps.henrik.getAccount(riotId.gameName, riotId.tagLine);
  } catch (error) {
    throw toLinkError(error);
  }
}

async function ownerOf(deps: SyncDeps, puuid: string): Promise<string | null> {
  const [row] = await deps.db
    .select({ userId: riotAccounts.userId })
    .from(riotAccounts)
    .where(eq(riotAccounts.puuid, puuid))
    .limit(1);
  return row?.userId ?? null;
}

/** Looks up a Riot ID for the confirmation card. Fails early if it's someone else's. */
export async function previewRiotAccount(
  deps: SyncDeps,
  userId: string,
  riotId: { gameName: string; tagLine: string },
): Promise<RiotAccountPreview> {
  const account = await lookup(deps, riotId);
  const owner = await ownerOf(deps, account.puuid);
  if (owner && owner !== userId) throw new LinkError("claimed");
  return {
    gameName: account.name,
    tagLine: account.tag,
    cardUrl: playerCardUrl(account.card),
    accountLevel: account.account_level ?? null,
  };
}

/** Claims the Riot account for `userId` (creating the row when it's new). */
export async function linkRiotAccount(
  deps: SyncDeps,
  userId: string,
  riotId: { gameName: string; tagLine: string },
): Promise<RiotAccount> {
  const [current] = await deps.db
    .select({ puuid: riotAccounts.puuid })
    .from(riotAccounts)
    .where(eq(riotAccounts.userId, userId))
    .limit(1);

  const account = await lookup(deps, riotId);
  if (current && current.puuid !== account.puuid) throw new LinkError("already_linked");

  const now = (deps.now ?? (() => new Date()))();
  const values = {
    gameName: account.name,
    tagLine: account.tag,
    cardUrl: playerCardUrl(account.card),
  };

  try {
    const [row] = await deps.db
      .insert(riotAccounts)
      .values({ ...values, puuid: account.puuid, userId, linkedAt: now, region: "br", platform: "pc" })
      .onConflictDoUpdate({
        target: riotAccounts.puuid,
        set: { ...values, userId, linkedAt: now },
        // Only unclaimed rows (or our own) can be taken over.
        setWhere: or(isNull(riotAccounts.userId), eq(riotAccounts.userId, userId)),
      })
      .returning();
    if (!row) throw new LinkError("claimed");
    return row;
  } catch (error) {
    if (error instanceof LinkError) throw error;
    // user_id unique violation: a parallel request linked another account.
    if (isUniqueViolation(error)) throw new LinkError("already_linked");
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown; cause?: { code?: unknown } })?.code ?? (error as { cause?: { code?: unknown } })?.cause?.code;
  return code === "23505";
}

