/**
 * Season names from the community catalog (valorant-api.com, same source as
 * the agent and map icons). Public, no key. Cached for days with "use cache"
 * (Cache Components), so pages don't call it per request. A failure throws
 * inside the cached function (errors aren't cached) and returns an empty
 * catalog here: labels fall back to dates, the page never breaks over a
 * season name.
 */
import "server-only";

import { cacheLife } from "next/cache";
import { cache } from "react";
import { z } from "zod";

import type { SeasonCatalog, SeasonInfo } from "./seasons";

const CATALOG_URL = "https://valorant-api.com/v1/seasons?language=pt-BR";

const catalogSchema = z.object({
  data: z.array(
    z.object({
      uuid: z.string(),
      title: z.string().nullish(),
      displayName: z.string().nullish(),
      startTime: z.string().nullish(),
    }),
  ),
});

/** Plain entries (serializable cache output). */
async function fetchCatalog(): Promise<[string, SeasonInfo][]> {
  "use cache";
  cacheLife("days");
  const response = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(3_000) });
  if (!response.ok) throw new Error(`season catalog: HTTP ${response.status}`);
  const parsed = catalogSchema.parse(await response.json());
  return parsed.data.map((s) => [
    s.uuid.toLowerCase(),
    { title: s.title ?? null, displayName: s.displayName ?? null, startTime: s.startTime ?? null },
  ]);
}

export const getSeasonCatalog = cache(async (): Promise<SeasonCatalog> => {
  try {
    return new Map(await fetchCatalog());
  } catch {
    return new Map();
  }
});
