/**
 * Server helper for the match history: the rows on screen plus their
 * per-match extras (tier, place in the team, RR). Always keyed by a puuid
 * the page already resolved and authorised.
 */
import "server-only";

import type { HistoryItem } from "@/components/history/history-row";
import type { DetailedLine } from "@/lib/stats/breakdown";

import { getMatchExtras } from "./queries";

export async function withExtras(puuid: string, lines: readonly DetailedLine[]): Promise<HistoryItem[]> {
  const extras = await getMatchExtras(
    puuid,
    lines.map((l) => l.matchId),
  );
  return lines.map((l) => {
    const e = extras.get(l.matchId);
    return {
      ...l,
      tier: e?.tier ?? null,
      teamPosition: e?.teamPosition ?? null,
      teamSize: e?.teamSize ?? 0,
      rrChange: e?.rrChange ?? null,
    };
  });
}
