/**
 * Season names from the community catalog (valorant-api.com, same source as
 * the agent and map icons). Public, no key; cached for a day by Next. Any
 * failure returns an empty catalog: labels fall back to dates, the page
 * never breaks over a season name.
 */
import "server-only";

import { cache } from "react";
import { z } from "zod";

import type { SeasonCatalog } from "./seasons";

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

export const getSeasonCatalog = cache(async (): Promise<SeasonCatalog> => {
  try {
    const response = await fetch(CATALOG_URL, { next: { revalidate: 86_400 }, signal: AbortSignal.timeout(3_000) });
    if (!response.ok) return new Map();
    const parsed = catalogSchema.safeParse(await response.json());
    if (!parsed.success) return new Map();
    return new Map(
      parsed.data.data.map((s) => [
        s.uuid.toLowerCase(),
        { title: s.title ?? null, displayName: s.displayName ?? null, startTime: s.startTime ?? null },
      ]),
    );
  } catch {
    return new Map();
  }
});
