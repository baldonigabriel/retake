/**
 * Pure metric formulas (CLAUDE.md › Fórmulas). Metrics are always computed
 * from raw match_players values, never stored ready-made.
 */

export type MatchResult = "win" | "loss" | "draw";

/** ACS = score / rounds_played */
export function acs(score: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? score / roundsPlayed : 0;
}

/** K/D = kills / max(deaths, 1) */
export function kd(kills: number, deaths: number): number {
  return kills / Math.max(deaths, 1);
}

/** KDA = (kills + assists) / max(deaths, 1) */
export function kda(kills: number, deaths: number, assists: number): number {
  return (kills + assists) / Math.max(deaths, 1);
}

/** HS% = headshots / (headshots + bodyshots + legshots), as a 0–1 ratio */
export function hsRate(headshots: number, bodyshots: number, legshots: number): number {
  const total = headshots + bodyshots + legshots;
  return total > 0 ? headshots / total : 0;
}

/** ADR = damage_dealt / rounds_played */
export function adr(damageDealt: number, roundsPlayed: number): number {
  return roundsPlayed > 0 ? damageDealt / roundsPlayed : 0;
}

/** Win rate = wins / matches. Draws count as non-wins and are reported separately. */
export function winRate(results: readonly MatchResult[]): {
  rate: number;
  wins: number;
  losses: number;
  draws: number;
} {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const r of results) {
    if (r === "win") wins++;
    else if (r === "loss") losses++;
    else draws++;
  }
  return { rate: results.length > 0 ? wins / results.length : 0, wins, losses, draws };
}
