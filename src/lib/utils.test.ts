import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("keeps a custom font-size and a text colour together", () => {
    expect(cn("text-stat-lg", "text-fg")).toBe("text-stat-lg text-fg");
  });

  it("lets a later custom font-size override an earlier one", () => {
    expect(cn("text-body-sm", "text-label")).toBe("text-label");
  });

  it("merges custom radius and shadow tokens", () => {
    expect(cn("rounded-card", "rounded-chip")).toBe("rounded-chip");
    expect(cn("shadow-hairline", "shadow-key")).toBe("shadow-key");
  });

  it("joins conditionals like clsx", () => {
    expect(cn("a", false && "b", { c: true, d: false })).toBe("a c");
  });
});
