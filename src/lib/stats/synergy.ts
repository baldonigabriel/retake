/**
 * Duo synergy: how the viewer plays when another Retake user is on the same
 * team. Pure: the caller loads the viewer's own lines plus, for each mate,
 * the (match, team) pairs where that mate appeared in the viewer's matches.
 *
 * Privacy (CLAUDE.md › Privacidade): mates are only Retake users who share a
 * group with the viewer. The caller enforces that when loading; nothing here
 * ever looks at players outside the `mates` list.
 *
 * Every number is the VIEWER's (their win rate, K/D and ACS in those
 * matches), weighted by volume like summarize(), in one mode at a time.
 * "Sua média" is the viewer's whole selection in the same mode, so the delta
 * says "with this person you win more/less than you usually do".
 */
import { DEFAULT_MODE, filterByMode, summarize, type PlayerMatchLine, type StatSummary } from "./aggregate";

/** Fewer matches together than this and the duo isn't listed at all. */
export const SYNERGY_MIN_MATCHES = 3;
/** Below this the duo is listed with a "amostra pequena" warning, after the reliable ones. */
export const SYNERGY_RELIABLE_MATCHES = 10;

export interface SynergyLine extends PlayerMatchLine {
  matchId: string;
  team: string;
  startedAt: Date;
}

export interface MateAppearance {
  matchId: string;
  team: string;
}

export interface SynergyMate<M> {
  puuid: string;
  /** Whatever the UI needs to show the mate (name, avatar, link…). */
  mate: M;
  appearances: readonly MateAppearance[];
}

export interface Duo<M> {
  mate: M;
  puuid: string;
  /** The viewer's numbers in the matches played on the same team. */
  summary: StatSummary;
  /** Win rate together − the viewer's win rate in the mode (0–1 scale). */
  winRateDelta: number;
  acsDelta: number;
  kdDelta: number;
  /** Fewer than SYNERGY_RELIABLE_MATCHES together: show it as a trend, with a warning. */
  smallSample: boolean;
  /** Matches together, newest first (for "ver as partidas"). */
  matchIds: string[];
}

export interface SynergyResult<M> {
  mode: string;
  /** The viewer's whole selection in `mode`: the "sua média" every duo is compared to. */
  baseline: StatSummary;
  /** Reliable duos first, then small samples; each block by win rate together. */
  duos: Duo<M>[];
  /** Mates who shared a team with the viewer, but fewer than the minimum times. */
  tooFew: { mate: M; puuid: string; matches: number }[];
}

export interface SynergyOptions {
  mode?: string;
  minMatches?: number;
  reliableMatches?: number;
}

const sameTeam = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function synergy<M>(
  viewerPuuid: string,
  viewerLines: readonly SynergyLine[],
  mates: readonly SynergyMate<M>[],
  options: SynergyOptions = {},
): SynergyResult<M> {
  const mode = options.mode ?? DEFAULT_MODE;
  const minMatches = Math.max(1, options.minMatches ?? SYNERGY_MIN_MATCHES);
  const reliable = options.reliableMatches ?? SYNERGY_RELIABLE_MATCHES;

  const selected = filterByMode(viewerLines, mode);
  const baseline = summarize(selected, { mode });
  const byMatch = new Map(selected.map((l) => [l.matchId, l]));

  const duos: Duo<M>[] = [];
  const tooFew: SynergyResult<M>["tooFew"] = [];
  const seen = new Set<string>();

  for (const entry of mates) {
    // The viewer is never their own duo, and a mate listed twice counts once.
    if (entry.puuid === viewerPuuid || seen.has(entry.puuid)) continue;
    seen.add(entry.puuid);

    const together = new Map<string, SynergyLine>();
    for (const a of entry.appearances) {
      const line = byMatch.get(a.matchId);
      // Opposite teams in the same match aren't "playing together".
      if (line && sameTeam(line.team, a.team)) together.set(line.matchId, line);
    }
    const lines = [...together.values()].sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());
    if (lines.length === 0) continue;
    if (lines.length < minMatches) {
      tooFew.push({ mate: entry.mate, puuid: entry.puuid, matches: lines.length });
      continue;
    }

    const summary = summarize(lines, { mode });
    duos.push({
      mate: entry.mate,
      puuid: entry.puuid,
      summary,
      winRateDelta: summary.winRate.rate - baseline.winRate.rate,
      acsDelta: summary.acs - baseline.acs,
      kdDelta: summary.kd - baseline.kd,
      smallSample: lines.length < reliable,
      matchIds: lines.map((l) => l.matchId),
    });
  }

  duos.sort(
    (a, b) =>
      Number(a.smallSample) - Number(b.smallSample) ||
      b.summary.winRate.rate - a.summary.winRate.rate ||
      b.summary.matches - a.summary.matches ||
      b.summary.acs - a.summary.acs,
  );
  tooFew.sort((a, b) => b.matches - a.matches);
  return { mode, baseline, duos, tooFew };
}

/**
 * The trend in words, never a verdict: "acima" / "abaixo" / "parecido" with
 * a ±3 p.p. dead zone so a coin flip doesn't read as chemistry.
 */
export const SYNERGY_FLAT_BAND = 0.03;

export function synergyTrend(winRateDelta: number): "up" | "down" | "flat" {
  if (winRateDelta > SYNERGY_FLAT_BAND) return "up";
  if (winRateDelta < -SYNERGY_FLAT_BAND) return "down";
  return "flat";
}
