/**
 * Aggregates over a player's match lines (a match_players row joined with
 * its match). Pure functions, computed on read — nothing here is stored.
 *
 * Multi-match metrics are weighted by volume (total score / total rounds,
 * total kills / total deaths, ...), not an average of per-match values, so a
 * 13-round stomp doesn't weigh as much as a 26-round overtime.
 *
 * Every summary is filtered by one mode (default: competitive) and reports
 * which mode it used, so the UI can always say what it's averaging.
 */
import { acs, adr, hsRate, kd, kda, winRate, type MatchResult } from "./metrics";

export const DEFAULT_MODE = "competitive";
/** Explicit opt-in to mix modes; the UI must label it as such. */
export const ALL_MODES = "all";

export interface PlayerMatchLine {
  queueId: string;
  roundsPlayed: number;
  /** From matches.winning_team: null means draw (or a mode without teams). */
  winningTeam: string | null;
  won: boolean;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  damageDealt: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
}

export function matchResult(line: Pick<PlayerMatchLine, "won" | "winningTeam">): MatchResult {
  if (line.won) return "win";
  return line.winningTeam === null ? "draw" : "loss";
}

export function filterByMode<T extends Pick<PlayerMatchLine, "queueId">>(
  lines: readonly T[],
  mode: string = DEFAULT_MODE,
): T[] {
  return mode === ALL_MODES ? [...lines] : lines.filter((l) => l.queueId === mode);
}

export interface StatSummary {
  mode: string;
  matches: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  kd: number;
  kda: number;
  /** 0–1 ratio */
  hsRate: number;
  adr: number;
  winRate: ReturnType<typeof winRate>;
}

export function summarize(lines: readonly PlayerMatchLine[], options: { mode?: string } = {}): StatSummary {
  const mode = options.mode ?? DEFAULT_MODE;
  const selected = filterByMode(lines, mode);

  const t = {
    rounds: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    score: 0,
    damage: 0,
    headshots: 0,
    bodyshots: 0,
    legshots: 0,
  };
  for (const l of selected) {
    t.rounds += l.roundsPlayed;
    t.kills += l.kills;
    t.deaths += l.deaths;
    t.assists += l.assists;
    t.score += l.score;
    t.damage += l.damageDealt;
    t.headshots += l.headshots;
    t.bodyshots += l.bodyshots;
    t.legshots += l.legshots;
  }

  return {
    mode,
    matches: selected.length,
    rounds: t.rounds,
    kills: t.kills,
    deaths: t.deaths,
    assists: t.assists,
    acs: acs(t.score, t.rounds),
    kd: kd(t.kills, t.deaths),
    kda: kda(t.kills, t.deaths, t.assists),
    hsRate: hsRate(t.headshots, t.bodyshots, t.legshots),
    adr: adr(t.damage, t.rounds),
    winRate: winRate(selected.map(matchResult)),
  };
}
