/**
 * Season (act) filter. Matches store the Riot season id; the readable name
 * comes from the community catalog (src/lib/seasons-api.ts). Pure: tested
 * without network, and every label has a fallback built from our own dates.
 */
import { DISPLAY_TIME_ZONE } from "@/lib/format";

export const ALL_SEASONS = "all";

export interface SeasonInfo {
  /** Catalog title, e.g. "V26 // ATO VI" or "EPISÓDIO 9 // ATO I" */
  title: string | null;
  displayName: string | null;
  startTime: string | null;
}

export type SeasonCatalog = ReadonlyMap<string, SeasonInfo>;

const capitalize = (word: string) => (/^[IVXLC]+$/.test(word) ? word : word.charAt(0) + word.slice(1).toLowerCase());

/**
 * "V26 // ATO VI" → "V26 · Ato VI"; "EPISÓDIO 9 // ATO I" → "E9 · Ato I".
 * Null when the catalog has nothing usable.
 */
export function seasonLabel(info: SeasonInfo | undefined): string | null {
  const raw = info?.title?.trim() || info?.displayName?.trim();
  if (!raw) return null;
  return raw
    .split("//")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const episode = /^EPIS[ÓO]DI?O\s+(\d+)$/i.exec(part);
      if (episode) return `E${episode[1]}`;
      return part.split(/\s+/).map(capitalize).join(" ");
    })
    .join(" · ");
}

/** Fallback when the catalog is unavailable: "Temporada de nov. 2026". */
export function seasonFallbackLabel(firstMatch: Date): string {
  const month = firstMatch
    .toLocaleDateString("pt-BR", { month: "short", year: "numeric", timeZone: DISPLAY_TIME_ZONE })
    .replace(" de ", " ");
  return `Temporada de ${month}`;
}

export interface SeasonOption {
  value: string;
  label: string;
  matches: number;
}

/**
 * Seasons the player has in `lines` (already filtered by mode), newest first,
 * after "Todas". Matches without a season id only show under "Todas".
 */
export function seasonOptions(
  lines: readonly { seasonId: string | null; startedAt: Date }[],
  catalog: SeasonCatalog,
): SeasonOption[] {
  const seen = new Map<string, { first: Date; last: Date; matches: number }>();
  for (const l of lines) {
    if (!l.seasonId) continue;
    const s = seen.get(l.seasonId);
    if (!s) seen.set(l.seasonId, { first: l.startedAt, last: l.startedAt, matches: 1 });
    else {
      s.matches++;
      if (l.startedAt < s.first) s.first = l.startedAt;
      if (l.startedAt > s.last) s.last = l.startedAt;
    }
  }
  const seasons = [...seen.entries()]
    .sort(([, a], [, b]) => b.last.getTime() - a.last.getTime())
    .map(([id, s]) => ({ value: id, label: seasonLabel(catalog.get(id.toLowerCase())) ?? seasonFallbackLabel(s.first), matches: s.matches }));
  return [{ value: ALL_SEASONS, label: "Todas", matches: lines.length }, ...seasons];
}

/** Accepts only a season from the options, else "all". */
export function parseSeason(value: unknown, options: readonly SeasonOption[]): string {
  return typeof value === "string" && options.some((o) => o.value === value) ? value : ALL_SEASONS;
}

export function filterBySeason<T extends { seasonId: string | null }>(lines: readonly T[], season: string): T[] {
  return season === ALL_SEASONS ? [...lines] : lines.filter((l) => l.seasonId === season);
}
