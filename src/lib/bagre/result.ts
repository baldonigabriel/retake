/**
 * Who is the Bagre (docs/SPEC.md §5.6). Pure. The caller passes only valid
 * entries: nominations of current members, votes of current members.
 *
 * - no nominations → "empty"; nominations but no votes → "no_votes";
 * - most votes → "winner";
 * - tied on votes → whoever played FEWER matches in the period wins;
 * - still tied → "tie" (declared draw, nobody gets the badge).
 */
export interface TallyEntry {
  nominationId: string;
  nomineeId: string;
  votes: number;
  /** Matches the nominee played in the period (all modes). */
  matches: number;
}

export type BagreDecision =
  | { outcome: "empty" | "no_votes"; tally: TallyEntry[] }
  | { outcome: "winner"; winner: TallyEntry; byTieBreak: boolean; tally: TallyEntry[] }
  | { outcome: "tie"; tied: TallyEntry[]; tally: TallyEntry[] };

/** Most votes first, then fewer matches, then a stable order. */
export function sortTally(entries: readonly TallyEntry[]): TallyEntry[] {
  return [...entries].sort(
    (a, b) => b.votes - a.votes || a.matches - b.matches || a.nominationId.localeCompare(b.nominationId),
  );
}

export function decideBagre(entries: readonly TallyEntry[]): BagreDecision {
  const tally = sortTally(entries);
  if (tally.length === 0) return { outcome: "empty", tally };
  const top = tally[0]!.votes;
  if (top === 0) return { outcome: "no_votes", tally };

  const leaders = tally.filter((e) => e.votes === top);
  if (leaders.length === 1) return { outcome: "winner", winner: leaders[0]!, byTieBreak: false, tally };

  const fewest = Math.min(...leaders.map((e) => e.matches));
  const tied = leaders.filter((e) => e.matches === fewest);
  if (tied.length === 1) return { outcome: "winner", winner: tied[0]!, byTieBreak: true, tally };
  return { outcome: "tie", tied, tally };
}
