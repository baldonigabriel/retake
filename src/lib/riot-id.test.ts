import { describe, expect, it } from "vitest";

import { parseRiotId } from "./riot-id";

describe("parseRiotId", () => {
  it("splits name and tag", () => {
    expect(parseRiotId("pastel de vento#SP11")).toEqual({ gameName: "pastel de vento", tagLine: "SP11" });
  });

  it("uses the last # as separator", () => {
    expect(parseRiotId("a#b#BR1")).toEqual({ gameName: "a#b", tagLine: "BR1" });
  });

  it.each(["semtag", "ab#BR1", "nome#B", "nome#TOOLONG", "nome#B-1", "#BR1"])("rejects %s", (input) => {
    expect(parseRiotId(input)).toBeNull();
  });
});
