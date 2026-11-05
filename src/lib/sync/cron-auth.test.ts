import { describe, expect, it } from "vitest";

import { isAuthorizedCron } from "./cron-auth";

const SECRET = "s3cret-value-with-enough-length";

describe("isAuthorizedCron", () => {
  it("accepts the exact bearer secret", () => {
    expect(isAuthorizedCron(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedCron(`bearer ${SECRET}`, SECRET)).toBe(true);
  });

  it.each([
    ["missing header", null],
    ["empty header", ""],
    ["wrong secret", "Bearer nope"],
    ["secret without scheme", SECRET],
    ["basic scheme", `Basic ${SECRET}`],
    ["prefix of the secret", `Bearer ${SECRET.slice(0, -1)}`],
  ])("rejects %s", (_, header) => {
    expect(isAuthorizedCron(header, SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    expect(isAuthorizedCron("Bearer ", undefined)).toBe(false);
    expect(isAuthorizedCron("Bearer anything", "")).toBe(false);
  });
});
