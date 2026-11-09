/**
 * Where a player's name on a scoreboard may link to (SPEC §6.5). Only Retake
 * users ever get a link: a group mate goes to the member profile (shows
 * more); anyone else only if their profile is public. Players who aren't
 * users, private users and the viewer themself stay plain text.
 */
export function playerProfileHref(
  puuid: string,
  ctx: {
    viewerPuuid: string;
    /** puuid → member profile path, for users who share a group with the viewer. */
    mates: ReadonlyMap<string, string>;
    /** puuid → /u/... path, for users whose profile is visible to everyone. */
    publicProfiles: ReadonlyMap<string, string>;
  },
): string | null {
  if (puuid === ctx.viewerPuuid) return null;
  return ctx.mates.get(puuid) ?? ctx.publicProfiles.get(puuid) ?? null;
}
