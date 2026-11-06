/**
 * Reads for the Bagre screen. The caller has already proved the viewer is a
 * member (getMembership); everything here is scoped to that group's current
 * members: nominations of people who left, and their votes, are dropped.
 */
import "server-only";

import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "@/db";
import { awardNominations, awardVotes, users, type AwardRound } from "@/db/schema";
import { getGroupMembers, getMemberLines, type MemberRow } from "@/lib/groups/queries";
import type { GroupLine } from "@/lib/groups/ranking";
import { suggestCandidates, type BagreSuggestion } from "@/lib/stats/bagre";

import { MIN_MATCHES_FOR_AVERAGE } from "./period";
import { currentRound, isAccepting, type BagreGroup } from "./rounds";

export interface PersonView {
  userId: string;
  name: string;
  tag: string | null;
  image: string | null;
  isYou: boolean;
}

export interface NominationView {
  id: string;
  nominee: PersonView;
  /** Null when the nominator left the group or deleted their account. */
  nominator: PersonView | null;
  comment: string;
  createdAt: Date;
  /** The nominee's line in the match (null if their Riot ID was unlinked since). */
  line: GroupLine | null;
  matchId: string;
  /** The match page only opens for players in it. */
  viewerPlayed: boolean;
  /** Null until the viewer votes (or the period closes): the server never sends it earlier. */
  votes: number | null;
}

export interface NomineeOption extends PersonView {
  hasAccount: boolean;
  /** Already nominated in this period (one nomination per person). */
  nominated: boolean;
  /** Their matches in the period, newest first. */
  lines: GroupLine[];
}

export interface BagreScreen {
  round: AwardRound | null;
  accepting: boolean;
  members: MemberRow[];
  nominations: NominationView[];
  suggestions: (BagreSuggestion<GroupLine> & { person: PersonView; nominated: boolean; viewerPlayed: boolean })[];
  options: NomineeOption[];
  /** The nomination the viewer voted for. */
  myVote: string | null;
  /** How many members voted (always shown; it says nothing about who is ahead). */
  voters: number;
  /** Counts are visible: the viewer voted, or the period is closed. */
  revealed: boolean;
}

export const person = (m: Pick<MemberRow, "userId" | "name" | "tag" | "image" | "isYou">): PersonView => ({
  userId: m.userId,
  name: m.name,
  tag: m.tag,
  image: m.image,
  isYou: m.isYou,
});

/** Nominations of a round, oldest first (never by votes: that would leak the count). */
export async function roundNominations(database: Database, roundId: string) {
  return database
    .select({
      id: awardNominations.id,
      nomineeId: awardNominations.nomineeId,
      nominatorId: awardNominations.nominatorId,
      matchId: awardNominations.matchId,
      comment: awardNominations.comment,
      createdAt: awardNominations.createdAt,
    })
    .from(awardNominations)
    .innerJoin(users, eq(users.id, awardNominations.nomineeId))
    .where(and(eq(awardNominations.roundId, roundId)))
    .orderBy(asc(awardNominations.createdAt), asc(awardNominations.id));
}

/** Votes of a round cast by these (current) members. Never sent to the browser as-is. */
export async function roundVotes(database: Database, roundId: string, memberIds: string[]) {
  if (memberIds.length === 0) return [];
  return database
    .select({ voterId: awardVotes.voterId, nominationId: awardVotes.nominationId })
    .from(awardVotes)
    .where(and(eq(awardVotes.roundId, roundId), inArray(awardVotes.voterId, memberIds)));
}

export async function loadBagreScreen(database: Database, group: BagreGroup, viewerId: string, now: Date): Promise<BagreScreen> {
  const [members, round] = await Promise.all([getGroupMembers(group.id, viewerId), currentRound(database, group, now)]);
  const empty: BagreScreen = {
    round,
    accepting: false,
    members,
    nominations: [],
    suggestions: [],
    options: [],
    myVote: null,
    voters: 0,
    revealed: false,
  };
  if (!round) return empty;

  const byId = new Map(members.map((m) => [m.userId, m]));
  const byPuuid = new Map(members.flatMap((m) => (m.puuid ? [[m.puuid, m] as const] : [])));
  const viewer = byId.get(viewerId);
  const [lines, rows, votes] = await Promise.all([
    getMemberLines([...byPuuid.keys()], round.startsAt, round.endsAt),
    roundNominations(database, round.id),
    roundVotes(database, round.id, [...byId.keys()]),
  ]);

  const lineOf = (matchId: string, puuid: string | null) =>
    puuid ? (lines.find((l) => l.matchId === matchId && l.puuid === puuid) ?? null) : null;
  const viewerPlayed = (matchId: string) => lineOf(matchId, viewer?.puuid ?? null) !== null;

  const nominations: NominationView[] = rows.flatMap((r) => {
    const nominee = byId.get(r.nomineeId);
    if (!nominee) return [];
    const nominator = r.nominatorId ? byId.get(r.nominatorId) : undefined;
    return [
      {
        id: r.id,
        nominee: person(nominee),
        nominator: nominator ? person(nominator) : null,
        comment: r.comment,
        createdAt: r.createdAt,
        line: lineOf(r.matchId, nominee.puuid),
        matchId: r.matchId,
        viewerPlayed: viewerPlayed(r.matchId),
        votes: null as number | null,
      },
    ];
  });
  const nominated = new Set(nominations.map((n) => n.nominee.userId));

  // Only votes for nominations still standing (nominee still a member) count.
  const valid = new Set(nominations.map((n) => n.id));
  const counted = votes.filter((v) => valid.has(v.nominationId));
  const myVote = counted.find((v) => v.voterId === viewerId)?.nominationId ?? null;
  const revealed = myVote !== null || round.status === "closed";
  if (revealed) {
    for (const n of nominations) n.votes = counted.filter((v) => v.nominationId === n.id).length;
  }

  const suggestions = suggestCandidates(
    members.map((m) => ({ userId: m.userId, puuid: m.puuid, name: m.name })),
    lines,
    { minMatches: MIN_MATCHES_FOR_AVERAGE[round.cadence] },
  ).map((s) => ({
    ...s,
    person: person(byId.get(s.userId)!),
    nominated: nominated.has(s.userId),
    viewerPlayed: viewerPlayed(s.matchId),
  }));

  const options: NomineeOption[] = members
    .filter((m) => m.userId !== viewerId)
    .map((m) => ({
      ...person(m),
      hasAccount: m.puuid !== null,
      nominated: nominated.has(m.userId),
      lines: m.puuid ? lines.filter((l) => l.puuid === m.puuid) : [],
    }));

  return {
    round,
    accepting: isAccepting(round, now) && group.bagreEnabled,
    members,
    nominations,
    suggestions,
    options,
    myVote,
    voters: counted.length,
    revealed,
  };
}
