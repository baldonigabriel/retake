import { describe, expect, it } from "vitest";

import { matchHref, matchPerspective, type MatchSubject } from "./access";

const players = ["me", "mate", "public", "private", "stranger"].map((puuid) => ({ puuid }));
const subjects: MatchSubject[] = [
  { puuid: "mate", userId: "u-mate", publicMatches: false },
  { puuid: "public", userId: "u-public", publicMatches: true },
  { puuid: "private", userId: "u-private", publicMatches: false },
];

describe("matchPerspective", () => {
  it("shows the viewer's own side when they played", () => {
    expect(matchPerspective(players, { viewerPuuid: "me", mates: new Set(["mate"]), subjects })).toEqual({ puuid: "me", isViewer: true });
  });

  it("opens a mate's match from the requested side", () => {
    const others = players.filter((p) => p.puuid !== "me");
    expect(
      matchPerspective(others, { viewerPuuid: "me", mates: new Set(["mate"]), subjects, requestedUserId: "u-public" }),
    ).toEqual({ puuid: "public", isViewer: false });
    expect(matchPerspective(others, { viewerPuuid: "me", mates: new Set(["mate"]), subjects })).toEqual({ puuid: "mate", isViewer: false });
  });

  it("never lets a private non-mate or a non-user open the match", () => {
    const only = [{ puuid: "private" }, { puuid: "stranger" }];
    expect(matchPerspective(only, { viewerPuuid: "me", mates: new Set(), subjects })).toBeNull();
    // Asking for someone who can't grant access falls back to who can, or to nothing.
    expect(
      matchPerspective([...only, { puuid: "public" }], { viewerPuuid: "me", mates: new Set(), subjects, requestedUserId: "u-private" }),
    ).toEqual({ puuid: "public", isViewer: false });
  });

  it("ignores a subject who isn't in this match", () => {
    expect(matchPerspective([{ puuid: "stranger" }], { viewerPuuid: "me", mates: new Set(["mate"]), subjects })).toBeNull();
  });
});

describe("matchHref", () => {
  it("adds the side only when given", () => {
    expect(matchHref("abc")).toBe("/match/abc");
    expect(matchHref("abc", "u 1")).toBe("/match/abc?as=u%201");
  });
});
