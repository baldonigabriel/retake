import { describe, expect, it } from "vitest";

import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it.each(["/me", "/match/abc", "/groups/os-cria?tab=ranking"])("keeps relative path %s", (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([undefined, null, "", "me", "//evil.com", "https://evil.com", "/\\evil.com", "/a\nb"])(
    "falls back for %j",
    (value) => {
      expect(safeNextPath(value)).toBe("/me");
    },
  );

  it("uses the first value of repeated params", () => {
    expect(safeNextPath(["/match/1", "/x"])).toBe("/match/1");
  });
});
