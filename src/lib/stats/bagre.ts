/**
 * Bagre suggestions (docs/SPEC.md §5.2). Pure: the caller passes the
 * members (only them, never other players) and their match lines inside the
 * period. Only competitive matches count, like every default in the app.
 *
 * Up to three suggestions, one per person, in criterion order:
 *   1. lowest average ACS (volume-weighted) among members with the minimum
 *      number of matches, when at least two members reached it;
 *   2. lowest K/D in a single match (≤ MAX_KD);
 *   3. heaviest loss by rounds (≥ MIN_LOSS_MARGIN).
 * Someone already picked is skipped and the criterion takes the next person
 * who meets it. Every suggestion points at one match of that person.
 */
import { formatNumber } from "@/lib/format";

import { DEFAULT_MODE, filterByMode, matchResult, summarize, type PlayerMatchLine } from "./aggregate";
import { acs, kd } from "./metrics";

export const MAX_KD = 0.75;
export const MIN_LOSS_MARGIN = 6;
export const MAX_SUGGESTIONS = 3;

export interface BagreMember {
  userId: string;
  puuid: string | null;
  name: string;
}

export interface BagreLine extends PlayerMatchLine {
  puuid: string;
  matchId: string;
  startedAt: Date;
  mapName: string | null;
  agentName: string | null;
  team: string;
  redScore: number | null;
  blueScore: number | null;
}

export type SuggestionKind = "low_acs" | "rough_match" | "heavy_loss";

export const SUGGESTION_LABEL: Record<SuggestionKind, string> = {
  low_acs: "Menor ACS médio",
  rough_match: "Partida pra esquecer",
  heavy_loss: "Derrota pesada",
};

export interface BagreSuggestion<L extends BagreLine = BagreLine> {
  userId: string;
  kind: SuggestionKind;
  /** One line, pt-BR, only numbers the group already sees. */
  reason: string;
  matchId: string;
  line: L;
}

/** Rounds won by the player's team and by the other one. Null when the API didn't give a score. */
export function teamScore(line: Pick<BagreLine, "team" | "redScore" | "blueScore">): { own: number; enemy: number } | null {
  if (line.redScore === null || line.blueScore === null) return null;
  const red = line.team.toLowerCase() === "red";
  return { own: red ? line.redScore : line.blueScore, enemy: red ? line.blueScore : line.redScore };
}

const lineAcs = (l: BagreLine) => acs(l.score, l.roundsPlayed);
const lineKd = (l: BagreLine) => kd(l.kills, l.deaths);
const newer = (a: BagreLine, b: BagreLine) => b.startedAt.getTime() - a.startedAt.getTime();
const onMap = (l: BagreLine) => (l.mapName ? ` na ${l.mapName}` : "");

function pick<T>(items: readonly T[], compare: (a: T, b: T) => number): T | undefined {
  return [...items].sort(compare)[0];
}

export function suggestCandidates<L extends BagreLine>(
  members: readonly BagreMember[],
  lines: readonly L[],
  options: { minMatches: number; limit?: number },
): BagreSuggestion<L>[] {
  const limit = options.limit ?? MAX_SUGGESTIONS;
  const byPuuid = new Map(members.filter((m) => m.puuid).map((m) => [m.puuid!, m]));
  const mine = filterByMode(lines, DEFAULT_MODE).filter((l) => byPuuid.has(l.puuid) && l.roundsPlayed > 0);
  const name = (l: L) => byPuuid.get(l.puuid)!.name;
  const byName = (a: L, b: L) => name(a).localeCompare(name(b), "pt-BR");

  const picked: BagreSuggestion<L>[] = [];
  const taken = new Set<string>();
  const add = (line: L, kind: SuggestionKind, reason: string) => {
    const member = byPuuid.get(line.puuid)!;
    taken.add(member.userId);
    picked.push({ userId: member.userId, kind, reason, matchId: line.matchId, line });
  };
  const free = (l: L) => !taken.has(byPuuid.get(l.puuid)!.userId);

  // 1. Lowest average ACS.
  const perPerson = new Map<string, L[]>();
  for (const l of mine) perPerson.set(l.puuid, [...(perPerson.get(l.puuid) ?? []), l]);
  const eligible = [...perPerson.values()].filter((ls) => ls.length >= options.minMatches);
  if (eligible.length >= 2) {
    const averages = eligible.map((ls) => ({ ls, avg: summarize(ls, { mode: DEFAULT_MODE }).acs }));
    const lowest = pick(
      averages,
      (a, b) => a.avg - b.avg || b.ls.length - a.ls.length || byName(a.ls[0]!, b.ls[0]!),
    )!;
    const worst = pick(lowest.ls, (a, b) => lineAcs(a) - lineAcs(b) || newer(a, b))!;
    add(
      worst,
      "low_acs",
      `ACS médio ${formatNumber(lowest.avg)} em ${lowest.ls.length} competitivas; a pior foi ${formatNumber(lineAcs(worst))}${onMap(worst)}`,
    );
  }

  // 2. Lowest K/D in one match.
  if (picked.length < limit) {
    const rough = pick(
      mine.filter((l) => free(l) && lineKd(l) <= MAX_KD),
      (a, b) => lineKd(a) - lineKd(b) || b.deaths - a.deaths || lineAcs(a) - lineAcs(b) || newer(a, b) || byName(a, b),
    );
    if (rough) {
      const agent = rough.agentName ? ` de ${rough.agentName}` : "";
      add(rough, "rough_match", `K/D ${formatNumber(lineKd(rough), 2)} (${rough.kills}/${rough.deaths}/${rough.assists})${agent}${onMap(rough)}`);
    }
  }

  // 3. Heaviest loss.
  if (picked.length < limit) {
    const losses = mine.flatMap((l) => {
      const score = teamScore(l);
      if (!free(l) || !score || matchResult(l) !== "loss") return [];
      const margin = score.enemy - score.own;
      return margin >= MIN_LOSS_MARGIN ? [{ l, score, margin }] : [];
    });
    const heavy = pick(losses, (a, b) => b.margin - a.margin || lineAcs(a.l) - lineAcs(b.l) || newer(a.l, b.l) || byName(a.l, b.l));
    if (heavy) {
      add(
        heavy.l,
        "heavy_loss",
        `Perdeu de ${heavy.score.own} a ${heavy.score.enemy}${onMap(heavy.l)}, com ACS ${formatNumber(lineAcs(heavy.l))}`,
      );
    }
  }

  return picked.slice(0, limit);
}
