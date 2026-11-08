import { describe, expect, it } from "vitest";

import type { Database } from "@/db";
import type { ServerEnv } from "@/env";

import { authOptions } from "./options";

const database = {} as Database;
const env = {
  DATABASE_URL: "postgresql://retake.example/test",
  BETTER_AUTH_SECRET: "a".repeat(32),
  BETTER_AUTH_URL: "https://retake.example",
  DISCORD_CLIENT_ID: "discord-client",
  DISCORD_CLIENT_SECRET: "discord-secret",
  GOOGLE_CLIENT_ID: "google-client",
  GOOGLE_CLIENT_SECRET: "google-secret",
} satisfies ServerEnv;

describe("authOptions", () => {
  it("configures Google and Discord as explicit linkable providers", () => {
    const options = authOptions(database, env);

    expect(options.socialProviders).toMatchObject({
      discord: { clientId: "discord-client" },
      google: { clientId: "google-client" },
    });
    expect(options.account.accountLinking).toEqual({
      enabled: true,
      disableImplicitLinking: true,
      trustedProviders: ["discord", "google"],
      allowDifferentEmails: true,
      allowUnlinkingAll: false,
      updateUserInfoOnLink: false,
    });
  });

  it("fails early when Google OAuth is not configured", () => {
    expect(() => authOptions(database, { ...env, GOOGLE_CLIENT_SECRET: undefined })).toThrow(
      "GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET",
    );
  });
});
