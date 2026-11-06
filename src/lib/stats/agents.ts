/**
 * Per-agent and per-map performance over a player's match lines. Pure: the
 * caller passes lines already filtered by mode (and season, when chosen), so
 * every number here belongs to one selection (CLAUDE.md › Regras de dados).
 *
 * Multi-match metrics are weighted by volume like summarize(): total score /
 * total rounds, total kills / total deaths, and so on.
 */
import { matchResult, type PlayerMatchLine } from "./aggregate";
import { acs, adr, ddDelta, hsRate, kd } from "./metrics";

export interface AgentLine extends PlayerMatchLine {
  matchId: string;
  agentId: string | null;
  agentName: string | null;
  mapId: string | null;
  mapName: string | null;
  damageReceived: number;
  /** null when the API didn't report the duration */
  gameLengthMs: number | null;
}

export interface PerformanceStats {
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  /** wins / matches (0–1); draws count as non-wins and are reported apart */
  winRate: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  kd: number;
  adr: number;
  /** 0–1 ratio */
  hsRate: number;
  /** (damage dealt − damage received) / rounds */
  ddDelta: number;
  /** Sum of game_length_ms over the matches that report it */
  playMs: number;
  /** Matches whose duration is known (playMs only covers these) */
  timedMatches: number;
}

/** Totals for any set of lines (an agent, a map, a day, the last 20...). */
export function performance(lines: readonly AgentLine[]): PerformanceStats {
  const t = {
    wins: 0,
    losses: 0,
    draws: 0,
    rounds: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    score: 0,
    dealt: 0,
    received: 0,
    headshots: 0,
    bodyshots: 0,
    legshots: 0,
    playMs: 0,
    timed: 0,
  };
  for (const l of lines) {
    const result = matchResult(l);
    if (result === "win") t.wins++;
    else if (result === "loss") t.losses++;
    else t.draws++;
    t.rounds += l.roundsPlayed;
    t.kills += l.kills;
    t.deaths += l.deaths;
    t.assists += l.assists;
    t.score += l.score;
    t.dealt += l.damageDealt;
    t.received += l.damageReceived;
    t.headshots += l.headshots;
    t.bodyshots += l.bodyshots;
    t.legshots += l.legshots;
    if (l.gameLengthMs != null && Number.isFinite(l.gameLengthMs) && l.gameLengthMs > 0) {
      t.playMs += l.gameLengthMs;
      t.timed++;
    }
  }
  const matches = lines.length;
  return {
    matches,
    wins: t.wins,
    losses: t.losses,
    draws: t.draws,
    winRate: matches > 0 ? t.wins / matches : 0,
    rounds: t.rounds,
    kills: t.kills,
    deaths: t.deaths,
    assists: t.assists,
    acs: acs(t.score, t.rounds),
    kd: kd(t.kills, t.deaths),
    adr: adr(t.dealt, t.rounds),
    hsRate: hsRate(t.headshots, t.bodyshots, t.legshots),
    ddDelta: ddDelta(t.dealt, t.received, t.rounds),
    playMs: t.playMs,
    timedMatches: t.timed,
  };
}

/** Hours played from a millisecond total (no rounding: the UI formats it). */
export const toHours = (ms: number) => ms / 3_600_000;

export interface MapStats extends PerformanceStats {
  key: string;
  mapId: string | null;
  mapName: string;
}

export interface AgentStats extends PerformanceStats {
  key: string;
  agentId: string | null;
  agentName: string;
  /** URL segment for /me/agents/[agent]; null for lines without an agent */
  slug: string | null;
  /** Best win rate with at least BEST_MAP_MIN_MATCHES matches; null when no map qualifies */
  bestMap: MapStats | null;
}

/** A map needs this many matches with the agent before it can be its "best map". */
export const BEST_MAP_MIN_MATCHES = 3;

const UNKNOWN_AGENT = "Agente desconhecido";
const UNKNOWN_MAP = "Mapa desconhecido";

/** "KAY/O" → "kay-o", "Raze" → "raze". Stable, URL-safe, case-insensitive. */
export function agentSlug(name: string | null | undefined): string {
  const slug = (name ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || "desconhecido";
}

function groupLines<K extends string>(
  lines: readonly AgentLine[],
  keyOf: (l: AgentLine) => K,
): Map<K, AgentLine[]> {
  const groups = new Map<K, AgentLine[]>();
  for (const l of lines) {
    const key = keyOf(l);
    const list = groups.get(key);
    if (list) list.push(l);
    else groups.set(key, [l]);
  }
  return groups;
}

/** Most matches first; ties: more time played, then name (deterministic). */
function byVolume<T extends PerformanceStats>(name: (x: T) => string) {
  return (a: T, b: T) => b.matches - a.matches || b.playMs - a.playMs || name(a).localeCompare(name(b), "pt-BR");
}

/** Per-map stats, most played first. */
export function mapStats(lines: readonly AgentLine[]): MapStats[] {
  return [...groupLines(lines, (l) => l.mapId ?? l.mapName ?? "?").entries()]
    .map(([key, group]) => {
      const first = group[0]!;
      return { key, mapId: first.mapId, mapName: first.mapName ?? UNKNOWN_MAP, ...performance(group) };
    })
    .sort(byVolume((m) => m.mapName));
}

/**
 * Highest win rate among maps with at least `minMatches` matches; ties go to
 * the map with more matches, then alphabetical (deterministic). Null when no
 * map has enough matches: a 1–0 record is not a "best map".
 */
export function bestMap(maps: readonly MapStats[], minMatches = BEST_MAP_MIN_MATCHES): MapStats | null {
  let best: MapStats | null = null;
  for (const m of maps) {
    if (m.matches < Math.max(1, minMatches)) continue;
    if (
      !best ||
      m.winRate > best.winRate ||
      (m.winRate === best.winRate &&
        (m.matches > best.matches || (m.matches === best.matches && m.mapName.localeCompare(best.mapName, "pt-BR") < 0)))
    ) {
      best = m;
    }
  }
  return best;
}

/**
 * One row per agent, most played first (ties: more time played, then name).
 * Lines without an agent are grouped under "Agente desconhecido".
 */
export function agentStats(
  lines: readonly AgentLine[],
  options: { bestMapMinMatches?: number } = {},
): AgentStats[] {
  return [...groupLines(lines, (l) => l.agentId ?? l.agentName ?? "?").entries()]
    .map(([key, group]) => {
      const first = group[0]!;
      return {
        key,
        agentId: first.agentId,
        agentName: first.agentName ?? UNKNOWN_AGENT,
        slug: first.agentName ? agentSlug(first.agentName) : null,
        bestMap: bestMap(mapStats(group), options.bestMapMinMatches),
        ...performance(group),
      };
    })
    .sort(byVolume((a) => a.agentName));
}

/** The lines played with the agent behind `slug` (case-insensitive). */
export function linesForAgent<T extends AgentLine>(lines: readonly T[], slug: string): T[] {
  const wanted = slug.toLowerCase();
  return lines.filter((l) => l.agentName !== null && agentSlug(l.agentName) === wanted);
}

/** Metric columns of the agents table; "best" is the highest value in each. */
export const AGENT_COLUMNS = ["winRate", "kd", "adr", "acs", "hsRate", "ddDelta"] as const;
export type AgentColumn = (typeof AGENT_COLUMNS)[number];

/**
 * Agents holding the best value of each metric column (ties: all of them).
 * Only agents with at least `minMatches` matches compete, and a column has a
 * best only when 2+ agents compete: one lucky match isn't a highlight.
 */
export function columnBests(
  agents: readonly AgentStats[],
  minMatches = BEST_MAP_MIN_MATCHES,
): Record<AgentColumn, Set<string>> {
  const eligible = agents.filter((a) => a.matches >= minMatches);
  const bests = {} as Record<AgentColumn, Set<string>>;
  for (const column of AGENT_COLUMNS) {
    bests[column] = new Set();
    if (eligible.length < 2) continue;
    const top = Math.max(...eligible.map((a) => a[column]));
    for (const a of eligible) if (a[column] === top) bests[column].add(a.key);
  }
  return bests;
}
