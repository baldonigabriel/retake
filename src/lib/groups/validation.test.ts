// @vitest-environment node
import { describe, expect, it } from "vitest";

import { newInviteCode } from "./invite";
import { createGroupSchema, inviteCodeSchema, maskWebhook, slugSchema, slugify, webhookUrlSchema } from "./validation";

const TOKEN = "aB3_dE-fGhIjKlMnOpQrStUvWxYz0123456789aBcDeFgHiJkLmNoPqRsTuVwXyZ0123";
const HOOK = `https://discord.com/api/webhooks/123456789012345678/${TOKEN}`;

describe("slugify", () => {
  it("turns a name into a URL slug", () => {
    expect(slugify("Os Parças!")).toBe("os-parcas");
    expect(slugify("  Time  ÁGUA   & Fogo ")).toBe("time-agua-fogo");
    expect(slugify("🔥🔥")).toBe("");
    expect(slugify("a".repeat(50))).toHaveLength(32);
    expect(slugify(`${"a".repeat(31)} b`)).toBe("a".repeat(31));
  });
});

describe("slugSchema", () => {
  it("accepts lowercase words with hyphens", () => {
    expect(slugSchema.parse("os-parcas")).toBe("os-parcas");
    expect(slugSchema.parse(" Squad5 ")).toBe("squad5");
  });

  it("rejects short, malformed and reserved slugs", () => {
    for (const bad of ["ab", "os--parcas", "-os", "os_parcas", "çá", "join", "settings", "a".repeat(33)]) {
      expect(slugSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("validates the create form", () => {
    expect(createGroupSchema.safeParse({ name: "Os Parças", slug: "os-parcas" }).success).toBe(true);
    expect(createGroupSchema.safeParse({ name: " a ", slug: "os-parcas" }).success).toBe(false);
  });
});

describe("invite codes", () => {
  it("are 24 url-safe random characters", () => {
    const a = newInviteCode();
    expect(inviteCodeSchema.safeParse(a).success).toBe(true);
    expect(a).not.toBe(newInviteCode());
    expect(inviteCodeSchema.safeParse("short").success).toBe(false);
    expect(inviteCodeSchema.safeParse("../../../../etc/passwd/xx").success).toBe(false);
  });
});

describe("webhookUrlSchema", () => {
  it("accepts Discord webhook URLs and normalises them", () => {
    expect(webhookUrlSchema.parse(HOOK)).toBe(HOOK);
    expect(webhookUrlSchema.parse(` https://discordapp.com/api/webhooks/123456789012345678/${TOKEN}?wait=true `)).toBe(HOOK);
    expect(webhookUrlSchema.parse(`https://ptb.discord.com/api/v10/webhooks/123456789012345678/${TOKEN}`)).toBe(HOOK);
  });

  it("rejects anything that isn't a Discord webhook", () => {
    for (const bad of [
      "",
      "not a url",
      HOOK.replace("https", "http"),
      HOOK.replace("discord.com", "evil.com"),
      HOOK.replace("discord.com", "discord.com.evil.com"),
      HOOK.replace("https://", "https://user:pw@"),
      HOOK.replace("discord.com", "discord.com:8443"),
      "https://discord.com/api/webhooks/123/abc",
      "https://hooks.slack.com/services/T000/B000/XXXX",
      "https://discord.com/channels/123456789012345678/123456789012345678",
    ]) {
      expect(webhookUrlSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it("masks the token for display", () => {
    expect(maskWebhook(HOOK)).toBe("discord.com/api/webhooks/…5678/••••••");
    expect(maskWebhook(HOOK)).not.toContain(TOKEN);
  });
});
