/**
 * The dashboard's tabs and the picks for its "Visão geral" (overview) tab.
 * Pure: the page passes what it already computed for the other tabs.
 */
import type { GroupStats } from "./breakdown";

export const DASHBOARD_TABS = [
  { value: "overview", label: "Visão geral" },
  { value: "matches", label: "Partidas" },
  { value: "agents", label: "Agentes" },
  { value: "maps", label: "Mapas" },
  { value: "combat", label: "Rounds e armas" },
  { value: "duos", label: "Duplas" },
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number]["value"];
export const DEFAULT_TAB: DashboardTab = "overview";

/**
 * ?tab= from the URL. A link filtered by a mate (`?with=`) without a tab
 * lands on the matches it filters, so older links keep working.
 */
export function parseTab(raw: unknown, options: { withMate?: boolean } = {}): DashboardTab {
  const value = Array.isArray(raw) ? raw[0] : raw;
  const found = DASHBOARD_TABS.find((t) => t.value === value);
  if (found) return found.value;
  return options.withMate ? "matches" : DEFAULT_TAB;
}

/** A map needs this many matches to be one of the overview's "best maps". */
export const OVERVIEW_MAP_MIN_MATCHES = 3;

/**
 * Best maps for the overview: highest win rate among maps with at least
 * OVERVIEW_MAP_MIN_MATCHES matches, ties to the map with more matches (same
 * rule as an agent's best map). Without any map that qualifies, an empty list.
 */
export function bestMaps(maps: readonly GroupStats[], limit = 3): GroupStats[] {
  return maps
    .filter((m) => m.summary.matches >= OVERVIEW_MAP_MIN_MATCHES)
    .sort(
      (a, b) =>
        b.summary.winRate.rate - a.summary.winRate.rate ||
        b.summary.matches - a.summary.matches ||
        a.name.localeCompare(b.name, "pt-BR"),
    )
    .slice(0, limit);
}
