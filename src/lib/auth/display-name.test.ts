import { describe, expect, it } from "vitest";

import { accountDisplayName } from "./display-name";

describe("accountDisplayName", () => {
  it("prefers the Riot ID name", () => {
    expect(accountDisplayName("Nome do Google", "Raze Main")).toBe("Raze Main");
  });

  it("falls back to the provider profile before onboarding", () => {
    expect(accountDisplayName("Nome do Discord", null)).toBe("Nome do Discord");
    expect(accountDisplayName("Nome do Google", "  ")).toBe("Nome do Google");
  });
});
