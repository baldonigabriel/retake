/**
 * Better Auth options shared by the app instance (src/lib/auth/index.ts) and
 * the e2e session seeding (e2e/global-setup.ts). No Next.js imports here, so
 * it also runs in plain Node.
 */
import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import type { Database } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import type { ServerEnv } from "@/env";

export const AUTH_BASE_PATH = "/api/auth";

export function authOptions(database: Database, env: ServerEnv) {
  const {
    BETTER_AUTH_SECRET,
    BETTER_AUTH_URL,
    DISCORD_CLIENT_ID,
    DISCORD_CLIENT_SECRET,
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
  } = env;
  if (!BETTER_AUTH_SECRET || !BETTER_AUTH_URL) {
    throw new Error("BETTER_AUTH_SECRET and BETTER_AUTH_URL must be set. See .env.example.");
  }
  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET) {
    throw new Error("DISCORD_CLIENT_ID and DISCORD_CLIENT_SECRET must be set. See .env.example.");
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error("GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set. See .env.example.");
  }

  return {
    appName: "Retake",
    secret: BETTER_AUTH_SECRET,
    baseURL: BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    database: drizzleAdapter(database, {
      provider: "pg",
      schema: { user: users, session: sessions, account: accounts, verification: verifications },
    }),
    // Social OAuth is the only way in (no email/password).
    socialProviders: {
      discord: {
        clientId: DISCORD_CLIENT_ID,
        clientSecret: DISCORD_CLIENT_SECRET,
      },
      google: {
        clientId: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // refresh once a day
      // Signed cookie with the session for 5 min: most requests skip the DB.
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    account: {
      // We never call the providers on the user's behalf, but tokens are still
      // stored by the OAuth flow: keep them encrypted at rest.
      encryptOAuthTokens: true,
      accountLinking: {
        enabled: true,
        // Linking is always an explicit, signed-in action in Settings. This
        // avoids silently merging users just because providers share an email.
        disableImplicitLinking: true,
        trustedProviders: ["discord", "google"],
        // A person's Google and Discord accounts do not have to share email.
        allowDifferentEmails: true,
        allowUnlinkingAll: false,
        updateUserInfoOnLink: false,
      },
    },
  } satisfies BetterAuthOptions;
}
