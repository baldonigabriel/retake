/**
 * Community asset URLs (media.valorant-api.com) for the ids the API returns.
 * Safe on the client: no keys involved. Ids are validated so a bad value
 * never ends up in a URL.
 */
const ASSETS = "https://media.valorant-api.com";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asset(kind: string, id: string | null | undefined, file: string): string | undefined {
  return id && UUID.test(id) ? `${ASSETS}/${kind}/${id.toLowerCase()}/${file}` : undefined;
}

/** Square agent portrait. */
export const agentIconUrl = (agentId: string | null | undefined) => asset("agents", agentId, "displayicon.png");

/** Wide map thumbnail (used in the per-map grid). */
export const mapThumbUrl = (mapId: string | null | undefined) => asset("maps", mapId, "listviewicon.png");

/** Large map splash (match header background). */
export const mapSplashUrl = (mapId: string | null | undefined) => asset("maps", mapId, "splash.png");

/** White weapon silhouette (kill feed icon), reads well on the dark surfaces. */
export const weaponIconUrl = (weaponId: string | null | undefined) => asset("weapons", weaponId, "killstreamicon.png");
