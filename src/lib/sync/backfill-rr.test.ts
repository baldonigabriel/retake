import { describe, expect, it } from "vitest";

import { storedHistorySize } from "./backfill-rr";

describe("storedHistorySize", () => {
  it("asks for twice what's missing, at least 20 and at most 200", () => {
    expect(storedHistorySize(1)).toBe(20);
    expect(storedHistorySize(35)).toBe(70);
    expect(storedHistorySize(500)).toBe(200);
  });
});
