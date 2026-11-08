/**
 * Data Access Layer for the signed-in user. Every page, Server Action and
 * Route Handler that needs the user goes through here (the proxy redirect is
 * only an optimistic check).
 */
import "server-only";

import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { db } from "@/db";
import { riotAccounts, type RiotAccount } from "@/db/schema";
import { safeNextPath } from "@/lib/auth/next-path";

import { auth } from ".";
import { accountDisplayName } from "./display-name";

export type SessionUser = { id: string; providerName: string; image: string | null };
export type ViewerIdentity = SessionUser & { displayName: string };

/** The current session, or null. Deduplicated per request. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth().api.getSession({ headers: await headers() });
  if (!session) return null;
  return { id: session.user.id, providerName: session.user.name, image: session.user.image ?? null };
});

export function loginPath(next?: string): string {
  const target = safeNextPath(next);
  return target === "/me" ? "/login" : `/login?next=${encodeURIComponent(target)}`;
}

/** Redirects to /login when signed out. */
export async function requireUser(next?: string): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(loginPath(next));
  return user;
}

/** The Riot account linked to this user, if any. */
export const getLinkedAccount = cache(async (userId: string): Promise<RiotAccount | null> => {
  const [row] = await db().select().from(riotAccounts).where(eq(riotAccounts.userId, userId)).limit(1);
  return row ?? null;
});

/** Identity used by app chrome: Riot name after onboarding, provider name before it. */
export const getViewerIdentity = cache(async (): Promise<ViewerIdentity | null> => {
  const user = await getSessionUser();
  if (!user) return null;
  const account = await getLinkedAccount(user.id);
  return { ...user, displayName: accountDisplayName(user.providerName, account?.gameName) };
});

/** Signed in and onboarded; otherwise redirects to /login or /onboarding. */
export async function requireViewer(next?: string): Promise<{ user: SessionUser; account: RiotAccount }> {
  const user = await requireUser(next);
  const account = await getLinkedAccount(user.id);
  if (!account) {
    // Come back here (e.g. a group invite) once the Riot ID is linked.
    const target = safeNextPath(next);
    redirect(target === "/me" ? "/onboarding" : `/onboarding?next=${encodeURIComponent(target)}`);
  }
  return { user, account };
}
