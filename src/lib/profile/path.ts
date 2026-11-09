/**
 * Public profile addresses (SPEC §6.3): `/u/Nome-TAG`. The LAST hyphen
 * splits the tag (tags are letters and digits only, names may contain a
 * hyphen); names with spaces or accents are percent-encoded. The address
 * follows the current Riot ID, so a renamed player changes address and the
 * old one answers 404. Internally everything stays keyed by puuid/user id.
 */

export type RiotIdParts = { gameName: string; tagLine: string };

export function profileSlug({ gameName, tagLine }: RiotIdParts): string {
  return encodeURIComponent(`${gameName}-${tagLine}`);
}

export function profilePath(id: RiotIdParts): string {
  return `/u/${profileSlug(id)}`;
}

/**
 * Parses the `[riotId]` route segment. Accepts it raw or still encoded
 * (Next hands dynamic segments over encoded). Null for anything that can't
 * be a Riot ID, so the page answers the same 404 without touching the DB.
 */
export function parseProfileSlug(raw: string): RiotIdParts | null {
  if (raw.length === 0 || raw.length > 200) return null;
  let value: string;
  try {
    value = decodeURIComponent(raw);
  } catch {
    return null;
  }
  const dash = value.lastIndexOf("-");
  if (dash === -1) return null;
  const gameName = value.slice(0, dash).trim();
  const tagLine = value.slice(dash + 1).trim();
  if ([...gameName].length < 3 || [...gameName].length > 16) return null;
  if (!/^[\p{L}\p{N}]{3,5}$/u.test(tagLine)) return null;
  return { gameName, tagLine };
}
