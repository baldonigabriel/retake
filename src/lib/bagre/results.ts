/**
 * Closed Bagre periods with what's needed to show them: the frozen tally,
 * who was nominated (and by whom), the comment and the nominee's own line in
 * the match. Framework-free (pages, the cron, scripts and tests use it).
 *
 * Privacy: people no longer in the group show up as "ex-membro", without
 * their match line. Nothing about players who aren't members is read.
 */
import { and, desc, eq, gt, inArray, isNotNull, lt, ne } from "drizzle-orm";

import type { Database } from "@/db";
import { awardNominations, awardRounds, groupMembers, matches, matchPlayers, riotAccounts, users, type AwardRound } from "@/db/schema";
import { accountDisplayName } from "@/lib/auth/display-name";

import type { NominatedLine } from "./display";
import type { Cadence } from "./period";
import { CATEGORY } from "./rounds";
import { sortTally, type TallyEntry } from "./result";

export const EX_MEMBER = "ex-membro";

export interface ResultPerson {
  userId: string | null;
  name: string;
  image: string | null;
  isYou: boolean;
  /** Still in the group. */
  member: boolean;
}

export interface ResultEntry {
  nominationId: string;
  nominee: ResultPerson;
  nominator: ResultPerson | null;
  comment: string;
  matchId: string;
  line: NominatedLine | null;
  viewerPlayed: boolean;
  votes: number;
  matches: number;
}

export type ClosedOutcome = "winner" | "tie" | "no_votes" | "empty" | "disabled";

export interface RoundResult {
  roundId: string;
  cadence: Cadence;
  startsAt: Date;
  endsAt: Date;
  closedAt: Date | null;
  outcome: ClosedOutcome;
  votesCast: number;
  badgeUntil: Date | null;
  /** Tally order: most votes first. */
  entries: ResultEntry[];
  winner: ResultEntry | null;
  tied: ResultEntry[];
  /** The winner tied on votes and won by playing fewer matches. */
  byTieBreak: boolean;
}

export interface LoadResultsOptions {
  viewerId?: string;
  /** Specific rounds (the announcement); otherwise the newest closed ones. */
  roundIds?: string[];
  limit?: number;
  /** Only rounds that ended before this instant (pagination). */
  before?: Date;
  /** Leave out periods where nothing happened. */
  skipEmpty?: boolean;
}

export async function loadResults(database: Database, groupId: string, options: LoadResultsOptions = {}): Promise<RoundResult[]> {
  const rounds = await database
    .select()
    .from(awardRounds)
    .where(
      and(
        eq(awardRounds.groupId, groupId),
        eq(awardRounds.category, CATEGORY),
        eq(awardRounds.status, "closed"),
        isNotNull(awardRounds.outcome),
        options.roundIds ? inArray(awardRounds.id, options.roundIds) : undefined,
        options.before ? lt(awardRounds.endsAt, options.before) : undefined,
        options.skipEmpty ? and(ne(awardRounds.outcome, "empty"), ne(awardRounds.outcome, "disabled")) : undefined,
      ),
    )
    .orderBy(desc(awardRounds.endsAt))
    .limit(options.limit ?? 20);
  return buildResults(database, groupId, rounds, options.viewerId);
}

/** Closed rounds (stored or simulated with the same shape) → what the screens and the card show. */
export async function buildResults(database: Database, groupId: string, rounds: AwardRound[], viewerId?: string): Promise<RoundResult[]> {
  if (rounds.length === 0) return [];
  const options = { viewerId };

  const [memberRows, noms] = await Promise.all([
    database.select({ userId: groupMembers.userId }).from(groupMembers).where(eq(groupMembers.groupId, groupId)),
    database
      .select()
      .from(awardNominations)
      .where(inArray(awardNominations.roundId, rounds.map((r) => r.id))),
  ]);
  const members = new Set(memberRows.map((m) => m.userId));

  const peopleIds = [
    ...new Set([...noms.map((n) => n.nomineeId), ...noms.flatMap((n) => (n.nominatorId ? [n.nominatorId] : [])), ...(options.viewerId ? [options.viewerId] : [])]),
  ];
  const people =
    peopleIds.length === 0
      ? []
      : await database
          .select({ userId: users.id, providerName: users.name, image: users.image, gameName: riotAccounts.gameName, puuid: riotAccounts.puuid })
          .from(users)
          .leftJoin(riotAccounts, eq(riotAccounts.userId, users.id))
          .where(inArray(users.id, peopleIds));
  const byId = new Map(people.map((p) => [p.userId, p]));

  const person = (userId: string | null): ResultPerson | null => {
    if (!userId) return null;
    const p = byId.get(userId);
    const member = members.has(userId);
    if (!p || !member) return { userId: null, name: EX_MEMBER, image: null, isYou: false, member: false };
    return { userId, name: accountDisplayName(p.providerName, p.gameName), image: p.image, isYou: userId === options.viewerId, member: true };
  };

  // The nominees' own lines in the nominated matches (members only), and whether the viewer played them.
  const matchIds = [...new Set(noms.map((n) => n.matchId))];
  const puuids = [
    ...new Set(
      noms.flatMap((n) => {
        const p = byId.get(n.nomineeId);
        return p?.puuid && members.has(n.nomineeId) ? [p.puuid] : [];
      }),
    ),
  ];
  const viewerPuuid = options.viewerId ? (byId.get(options.viewerId)?.puuid ?? null) : null;
  const wanted = viewerPuuid ? [...puuids, viewerPuuid] : puuids;
  const lineRows =
    matchIds.length === 0 || wanted.length === 0
      ? []
      : await database
          .select({
            puuid: matchPlayers.puuid,
            matchId: matches.id,
            startedAt: matches.startedAt,
            queueId: matches.queueId,
            mode: matches.mode,
            mapId: matches.mapId,
            mapName: matches.mapName,
            roundsPlayed: matches.roundsPlayed,
            winningTeam: matches.winningTeam,
            redScore: matches.redScore,
            blueScore: matches.blueScore,
            team: matchPlayers.team,
            agentId: matchPlayers.agentId,
            agentName: matchPlayers.agentName,
            won: matchPlayers.won,
            kills: matchPlayers.kills,
            deaths: matchPlayers.deaths,
            assists: matchPlayers.assists,
            score: matchPlayers.score,
            damageDealt: matchPlayers.damageDealt,
            headshots: matchPlayers.headshots,
            bodyshots: matchPlayers.bodyshots,
            legshots: matchPlayers.legshots,
          })
          .from(matchPlayers)
          .innerJoin(matches, eq(matches.id, matchPlayers.matchId))
          .where(and(inArray(matchPlayers.matchId, matchIds), inArray(matchPlayers.puuid, wanted)));

  return rounds.map((round): RoundResult => {
    const tally = sortTally((round.tally as TallyEntry[] | null) ?? []);
    const entries = tally.flatMap((t): ResultEntry[] => {
      const n = noms.find((x) => x.id === t.nominationId);
      if (!n) return [];
      const nominee = person(n.nomineeId)!;
      const puuid = nominee.member ? byId.get(n.nomineeId)?.puuid : undefined;
      return [
        {
          nominationId: n.id,
          nominee,
          nominator: person(n.nominatorId),
          comment: n.comment,
          matchId: n.matchId,
          line: puuid ? (lineRows.find((l) => l.matchId === n.matchId && l.puuid === puuid) ?? null) : null,
          viewerPlayed: viewerPuuid !== null && lineRows.some((l) => l.matchId === n.matchId && l.puuid === viewerPuuid),
          votes: t.votes,
          matches: t.matches,
        },
      ];
    });
    const winner = round.outcome === "winner" ? (entries.find((e) => e.nominationId === round.winnerNominationId) ?? null) : null;
    const top = entries[0]?.votes ?? 0;
    const tied = round.outcome === "tie" ? entries.filter((e) => e.votes === top && e.matches === entries[0]!.matches) : [];
    return {
      roundId: round.id,
      cadence: round.cadence,
      startsAt: round.startsAt,
      endsAt: round.endsAt,
      closedAt: round.closedAt,
      outcome: round.outcome!,
      votesCast: round.votesCast ?? 0,
      badgeUntil: round.badgeUntil,
      entries,
      winner,
      tied,
      byTieBreak: winner !== null && entries.filter((e) => e.votes === winner.votes).length > 1,
    };
  });
}

/** Current badge holders of a group: winners whose badge hasn't expired, newest first. */
export async function currentBadges(database: Database, groupId: string, now: Date) {
  const rows = await database
    .select({ userId: awardRounds.winnerUserId, cadence: awardRounds.cadence, endsAt: awardRounds.endsAt })
    .from(awardRounds)
    .where(
      and(
        eq(awardRounds.groupId, groupId),
        eq(awardRounds.category, CATEGORY),
        eq(awardRounds.outcome, "winner"),
        isNotNull(awardRounds.winnerUserId),
        gt(awardRounds.badgeUntil, now),
      ),
    )
    .orderBy(desc(awardRounds.endsAt))
    .limit(10);
  const badges = new Map<string, { cadence: Cadence; endsAt: Date }>();
  for (const r of rows) {
    if (!r.userId) continue;
    if (!badges.has(r.userId)) badges.set(r.userId, { cadence: r.cadence, endsAt: r.endsAt });
  }
  return badges;
}
