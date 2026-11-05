import { describe, expect, it } from "vitest";

import {
  IMPORT_PAGES,
  IMPORT_WINDOW_MS,
  SYNC_NOW_COOLDOWN_MS,
  canImportPage,
  isLastPage,
  syncCooldownLeft,
} from "./initial-import";

const now = new Date("2026-11-05T20:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);

describe("canImportPage", () => {
  it("allows every page right after linking", () => {
    for (let page = 0; page < IMPORT_PAGES; page++) {
      expect(canImportPage({ linkedAt: ago(1_000) }, page, now)).toBe(true);
    }
  });

  it.each([-1, IMPORT_PAGES, 1.5, Number.NaN])("rejects page %s", (page) => {
    expect(canImportPage({ linkedAt: ago(1_000) }, page, now)).toBe(false);
  });

  it("closes after the import window", () => {
    expect(canImportPage({ linkedAt: ago(IMPORT_WINDOW_MS + 1) }, 0, now)).toBe(false);
  });

  it("requires a linked account", () => {
    expect(canImportPage({ linkedAt: null }, 0, now)).toBe(false);
  });
});

describe("isLastPage", () => {
  it("stops on a short page or on the last allowed one", () => {
    expect(isLastPage(0, 5)).toBe(false);
    expect(isLastPage(0, 3)).toBe(true);
    expect(isLastPage(IMPORT_PAGES - 1, 5)).toBe(true);
  });
});

describe("syncCooldownLeft", () => {
  it("is zero when never synced or after 2 minutes", () => {
    expect(syncCooldownLeft({ lastSyncedAt: null }, now)).toBe(0);
    expect(syncCooldownLeft({ lastSyncedAt: ago(SYNC_NOW_COOLDOWN_MS) }, now)).toBe(0);
  });

  it("counts down inside the cooldown", () => {
    expect(syncCooldownLeft({ lastSyncedAt: ago(30_000) }, now)).toBe(SYNC_NOW_COOLDOWN_MS - 30_000);
  });
});
