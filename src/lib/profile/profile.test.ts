import { describe, expect, it } from "vitest";

import { playerProfileHref } from "./links";
import { parseProfileSlug, profilePath, profileSlug } from "./path";
import { WindowLimiter, clientIp } from "./rate-limit";
import { escapeLike, foldName, parseSearchQuery, rankResults } from "./search";
import {
  ALL_FIELDS_ON,
  DEFAULT_PROFILE_SETTINGS,
  choiceFromSettings,
  isProfileVisible,
  profileChoiceSchema,
  settingsFromChoice,
  visibleFields,
} from "./settings";

const NONE = { showRank: false, showOverview: false, showAgents: false, showMaps: false, showWeapons: false, showMatches: false };

describe("profile visibility", () => {
  it("is private by default (no row)", () => {
    expect(isProfileVisible(DEFAULT_PROFILE_SETTINGS)).toBe(false);
    expect(choiceFromSettings(DEFAULT_PROFILE_SETTINGS)).toBeNull();
  });

  it("is visible only when public with at least one section on", () => {
    expect(isProfileVisible({ ...ALL_FIELDS_ON, isPublic: true })).toBe(true);
    expect(isProfileVisible({ ...NONE, showMaps: true, isPublic: true })).toBe(true);
    expect(isProfileVisible({ ...NONE, isPublic: true })).toBe(false);
    expect(isProfileVisible({ ...ALL_FIELDS_ON, isPublic: false })).toBe(false);
  });

  it("lists the visible sections in page order", () => {
    expect(visibleFields({ ...NONE, showMatches: true, showWeapons: true, showRank: true })).toEqual(["showRank", "showWeapons", "showMatches"]);
  });

  it("stores public with nothing checked as private, keeping the section choices", () => {
    expect(settingsFromChoice({ visibility: "public", fields: NONE })).toEqual({ ...NONE, isPublic: false });
    expect(settingsFromChoice({ visibility: "private", fields: ALL_FIELDS_ON })).toEqual({ ...ALL_FIELDS_ON, isPublic: false });
    expect(settingsFromChoice({ visibility: "public", fields: { ...NONE, showAgents: true } })).toEqual({
      ...NONE,
      showAgents: true,
      isPublic: true,
    });
  });

  it("pre-fills the controls only after the user decided", () => {
    const decided = { ...DEFAULT_PROFILE_SETTINGS, isPublic: true, showMaps: false, decidedAt: new Date() };
    expect(choiceFromSettings(decided)).toEqual({ visibility: "public", fields: { ...ALL_FIELDS_ON, showMaps: false } });
  });

  it("rejects unknown fields and visibilities", () => {
    expect(profileChoiceSchema.safeParse({ visibility: "friends", fields: ALL_FIELDS_ON }).success).toBe(false);
    expect(profileChoiceSchema.safeParse({ visibility: "public", fields: { ...ALL_FIELDS_ON, showGroups: true } }).success).toBe(false);
    expect(profileChoiceSchema.safeParse({ visibility: "public", fields: ALL_FIELDS_ON }).success).toBe(true);
  });
});

describe("profile path", () => {
  it("joins name and tag with a hyphen and encodes spaces and accents", () => {
    expect(profilePath({ gameName: "Tester", tagLine: "E2E" })).toBe("/u/Tester-E2E");
    expect(profileSlug({ gameName: "João Mão", tagLine: "BR1" })).toBe("Jo%C3%A3o%20M%C3%A3o-BR1");
  });

  it("splits on the last hyphen, so names with hyphens survive the round trip", () => {
    const id = { gameName: "a-b-c", tagLine: "777" };
    expect(parseProfileSlug(profileSlug(id))).toEqual(id);
    expect(parseProfileSlug("João Mão-BR1")).toEqual({ gameName: "João Mão", tagLine: "BR1" });
    expect(parseProfileSlug(profileSlug({ gameName: "João Mão", tagLine: "BR1" }))).toEqual({ gameName: "João Mão", tagLine: "BR1" });
  });

  it("refuses anything that can't be a Riot ID", () => {
    for (const bad of ["", "Tester", "Tester-", "-E2E", "ab-E2E", "Tester-E2E!", "Tester-TOOLONG", "%E0%A4%A", "a".repeat(17) + "-BR1"]) {
      expect(parseProfileSlug(bad)).toBeNull();
    }
  });
});

describe("search query", () => {
  it("folds case and accents like the SQL retake_fold", () => {
    expect(foldName("JoÃO Çé")).toBe("joao ce");
  });

  it("needs 3 characters of name, with or without #TAG", () => {
    expect(parseSearchQuery(undefined)).toEqual({ kind: "empty" });
    expect(parseSearchQuery("   ")).toEqual({ kind: "empty" });
    expect(parseSearchQuery("ab")).toEqual({ kind: "too_short", text: "ab" });
    expect(parseSearchQuery("ab#BR1")).toEqual({ kind: "too_short", text: "ab#BR1" });
    expect(parseSearchQuery(" Pârceiro ")).toEqual({ kind: "ok", text: "Pârceiro", name: "parceiro", tag: null });
    expect(parseSearchQuery("Parceiro#e2")).toEqual({ kind: "ok", text: "Parceiro#e2", name: "parceiro", tag: "e2" });
    expect(parseSearchQuery("Parceiro#")).toMatchObject({ kind: "ok", tag: null });
    expect(parseSearchQuery(["Parceiro", "x"])).toMatchObject({ kind: "ok", name: "parceiro" });
  });

  it("escapes LIKE wildcards", () => {
    expect(escapeLike("a_b%c\\")).toBe("a\\_b\\%c\\\\");
  });

  it("ranks exact names, then prefixes, then the rest", () => {
    const rows = [
      { gameName: "Xparceiro", tagLine: "AAA" },
      { gameName: "Parceiro Dois", tagLine: "AAA" },
      { gameName: "Parceiro", tagLine: "E2E" },
    ];
    expect(rankResults(rows, "parceiro").map((r) => r.gameName)).toEqual(["Parceiro", "Parceiro Dois", "Xparceiro"]);
  });
});

describe("search rate limit", () => {
  it("allows the quota per window and resets after it", () => {
    const limiter = new WindowLimiter(2, 1000);
    expect(limiter.take("ip", 0)).toBe(true);
    expect(limiter.take("ip", 10)).toBe(true);
    expect(limiter.take("ip", 20)).toBe(false);
    expect(limiter.take("other", 20)).toBe(true);
    expect(limiter.take("ip", 1000)).toBe(true);
  });

  it("stays bounded in memory", () => {
    const limiter = new WindowLimiter(1, 1000, 3);
    for (let i = 0; i < 10; i++) limiter.take(`ip${i}`, 0);
    // The newest key is still tracked; the bucket never grew past the cap.
    expect(limiter.take("ip9", 1)).toBe(false);
    expect((limiter as unknown as { hits: Map<string, unknown> }).hits.size).toBeLessThanOrEqual(3);
  });

  it("reads the client ip from the proxy headers", () => {
    const headers = new Map([["x-forwarded-for", "1.2.3.4, 10.0.0.1"]]);
    expect(clientIp((n) => headers.get(n) ?? null)).toBe("1.2.3.4");
    expect(clientIp(() => null)).toBe("unknown");
  });
});

describe("scoreboard links", () => {
  const ctx = {
    viewerPuuid: "me",
    mates: new Map([["mate", "/groups/g/members/u1"]]),
    publicProfiles: new Map([
      ["mate", "/u/Mate-BR1"],
      ["pub", "/u/Pub-BR1"],
    ]),
  };

  it("links mates to the member profile even when they are public", () => {
    expect(playerProfileHref("mate", ctx)).toBe("/groups/g/members/u1");
  });

  it("links other users only when their profile is public", () => {
    expect(playerProfileHref("pub", ctx)).toBe("/u/Pub-BR1");
    expect(playerProfileHref("private-or-not-a-user", ctx)).toBeNull();
  });

  it("never links the viewer's own row", () => {
    expect(playerProfileHref("me", { ...ctx, publicProfiles: new Map([["me", "/u/Me-BR1"]]) })).toBeNull();
  });
});
