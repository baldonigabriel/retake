/**
 * How a nominated match is described, on screen and in the Discord card.
 * Pure and client-safe. Only the nominee's own line: the same numbers the
 * group already sees on the member profile, never other players.
 */
import { formatNumber } from "@/lib/format";
import { modeLabel } from "@/lib/modes";
import { matchResult } from "@/lib/stats/aggregate";
import { teamScore, type BagreLine } from "@/lib/stats/bagre";
import { acs, type MatchResult } from "@/lib/stats/metrics";

export interface NominatedLine extends BagreLine {
  mode: string | null;
  mapId: string | null;
  agentId: string | null;
}

export interface LineFacts {
  result: MatchResult;
  map: string;
  mode: string;
  /** "3–13", from the player's side; null without a score. */
  score: string | null;
  agent: string | null;
  kda: string;
  acs: number;
}

export function lineFacts(line: NominatedLine): LineFacts {
  const s = teamScore(line);
  return {
    result: matchResult(line),
    map: line.mapName ?? "Mapa desconhecido",
    mode: modeLabel(line.queueId, line.mode),
    score: s ? `${s.own}–${s.enemy}` : null,
    agent: line.agentName,
    kda: `${line.kills}/${line.deaths}/${line.assists}`,
    acs: Math.round(acs(line.score, line.roundsPlayed)),
  };
}

const RESULT_WORD: Record<MatchResult, string> = { win: "vitória", loss: "derrota", draw: "empate" };

/** "Lotus · Competitiva · derrota 3–13 · Jett 4/13/2 · ACS 98" */
export function describeLine(line: NominatedLine): string {
  const f = lineFacts(line);
  return [
    f.map,
    f.mode,
    `${RESULT_WORD[f.result]}${f.score ? ` ${f.score}` : ""}`,
    `${f.agent ? `${f.agent} ` : ""}${f.kda}`,
    `ACS ${formatNumber(f.acs)}`,
  ].join(" · ");
}
