/**
 * Who may open a match page, and from whose side it is shown (SPEC §6.5).
 *
 * A logged-in viewer opens a match when they played it, OR a mate from one of
 * their groups played it, OR a Retake user whose public profile shows matches
 * played it. Players who aren't users never grant access: they only appear on
 * the scoreboard of a match that is already open. Anything else is the same
 * 404 as a match that doesn't exist.
 *
 * The page is shown from the viewer's side when they played; otherwise from
 * the player whose profile the link came from (`?as=<userId>`, validated
 * against the allowed players), else the first allowed player.
 */
export type MatchSubject = {
  puuid: string;
  /** Retake user id of that riot account. */
  userId: string;
  /** Public profile with the "matches" section on. */
  publicMatches: boolean;
};

export type Perspective = { puuid: string; isViewer: boolean };

export function matchPerspective(
  players: readonly { puuid: string }[],
  ctx: {
    viewerPuuid: string;
    /** puuids of users who share a group with the viewer. */
    mates: ReadonlySet<string>;
    /** Retake users among the players (anyone else is absent). */
    subjects: readonly MatchSubject[];
    /** `?as=` from the URL: a user id, never trusted. */
    requestedUserId?: string | null;
  },
): Perspective | null {
  if (players.some((p) => p.puuid === ctx.viewerPuuid)) return { puuid: ctx.viewerPuuid, isViewer: true };
  const inMatch = new Set(players.map((p) => p.puuid));
  const allowed = ctx.subjects.filter((s) => inMatch.has(s.puuid) && (ctx.mates.has(s.puuid) || s.publicMatches));
  if (allowed.length === 0) return null;
  const requested = ctx.requestedUserId ? allowed.find((s) => s.userId === ctx.requestedUserId) : undefined;
  return { puuid: (requested ?? allowed[0]!).puuid, isViewer: false };
}

/** Link to a match seen from `userId`'s side (the viewer's own matches need no `as`). */
export function matchHref(matchId: string, asUserId?: string | null): string {
  return `/match/${encodeURIComponent(matchId)}${asUserId ? `?as=${encodeURIComponent(asUserId)}` : ""}`;
}
