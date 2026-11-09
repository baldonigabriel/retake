import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/match/back-link";
import { MatchHeader } from "@/components/match/match-header";
import { RoundTimeline } from "@/components/match/round-timeline";
import { ScoreboardTable } from "@/components/match/scoreboard-table";
import { requireViewer } from "@/lib/auth/session";
import { getGroupMatePuuids } from "@/lib/groups/queries";
import { matchPerspective } from "@/lib/match/access";
import { getMatch, getMatchRrForUsers } from "@/lib/match/queries";
import { buildScoreboard } from "@/lib/match/scoreboard";
import { playerProfileHref } from "@/lib/profile/links";
import { getMatchSubjects, getMateProfilePaths, getPublicProfilePaths } from "@/lib/profile/queries";
import { calculatePlayerRoundMetrics } from "@/lib/rounds";
import { getRoundDataset } from "@/lib/rounds/queries";

export const metadata: Metadata = {
  title: "Partida",
  description: "Placar completo da partida.",
};

export default async function MatchPage({ params, searchParams }: PageProps<"/match/[id]">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const { user, account } = await requireViewer(`/match/${id}`);
  const [found, mates] = await Promise.all([getMatch(decodeURIComponent(id)), getGroupMatePuuids(user.id)]);
  if (!found) notFound();
  // Who may open it and from whose side (src/lib/match/access.ts): the viewer if they
  // played, else a mate or a public profile that shows matches. Anyone else: 404.
  const subjects = await getMatchSubjects(found.players.map((p) => p.puuid));
  const perspective = matchPerspective(found.players, {
    viewerPuuid: account.puuid,
    mates,
    subjects,
    requestedUserId: typeof query.as === "string" && query.as.length <= 200 ? query.as : null,
  });
  if (!perspective) notFound();
  // Seen from outside: a public-only player who hides their rank keeps it hidden here too.
  const hiddenRank = new Set(
    perspective.isViewer ? [] : subjects.filter((s) => !mates.has(s.puuid) && !s.publicRank).map((s) => s.puuid),
  );
  const detail = {
    match: found.match,
    players: found.players.map((p) => (hiddenRank.has(p.puuid) ? { ...p, tier: null } : p)),
  };
  const subjectName = perspective.isViewer ? null : detail.players.find((p) => p.puuid === perspective.puuid)?.gameName ?? null;
  // SPEC §6.5: names link only for Retake users: mates to their member profile, others only if public.
  const [matePaths, publicPaths] = await Promise.all([
    getMateProfilePaths(user.id),
    getPublicProfilePaths(detail.players.map((p) => p.puuid)),
  ]);
  const roundDataset = await getRoundDataset([detail.match.id]);
  const roundStats = new Map(
    detail.players.map((player) => [player.puuid, calculatePlayerRoundMetrics({ puuid: player.puuid, ...roundDataset })]),
  );

  const board = buildScoreboard(detail.match, detail.players, perspective.puuid);
  const competitive = detail.match.queueId === "competitive";
  // RR only for Retake users; everyone else shows just the rank they had.
  const rrPuuids = detail.players.map((p) => p.puuid).filter((puuid) => perspective.isViewer || !hiddenRank.has(puuid));
  const rr = competitive ? await getMatchRrForUsers(detail.match.id, rrPuuids) : new Map<string, number | null>();
  // Members of the viewer's groups get a discreet "grupo" badge (DESIGN.md › Placar).
  const teams = board.teams.map((t) => ({
    ...t,
    players: t.players.map((p) => {
      const stats = roundStats.get(p.id);
      const multi = stats
        ? [stats.multiKills.three ? `${stats.multiKills.three}×3K` : "", stats.multiKills.four ? `${stats.multiKills.four}×4K` : "", stats.multiKills.ace ? `${stats.multiKills.ace}×Ás` : ""].filter(Boolean).join(" · ")
        : "";
      return {
        ...p,
        inGroup: p.id !== account.puuid && mates.has(p.id),
        href: playerProfileHref(p.id, { viewerPuuid: account.puuid, mates: matePaths, publicProfiles: publicPaths }),
        rr: rr.has(p.id) ? rr.get(p.id) : undefined,
        roundStats:
          stats && stats.rounds > 0
            ? { firstBloods: stats.firstBlood.successes, firstDeaths: stats.firstDeath.successes, kast: stats.kast.value, multiKills: multi }
            : undefined,
      };
    }),
  }));

  return (
    <div className="content-enter flex flex-col gap-4 py-6 sm:py-8">
      <BackLink />
      {subjectName ? (
        <p className="text-fg-secondary">
          Partida vista pelo lado de <span className="font-medium text-fg">{subjectName}</span>. Você não jogou esta.
        </p>
      ) : null}
      <MatchHeader match={detail.match} board={board} />
      <RoundTimeline
        rounds={roundDataset.rounds}
        players={roundDataset.players}
        kills={roundDataset.kills}
        viewerPuuid={perspective.puuid}
        names={new Map(detail.players.map((player) => [player.puuid, player.gameName]))}
      />
      <div className="flex flex-col gap-4">
        {teams.map((team) => (
          <ScoreboardTable
            key={team.id}
            team={team}
            roundsPlayed={detail.match.roundsPlayed}
            headingLevel="h2"
            showRr={competitive}
            highlightLabel={subjectName ?? "você"}
          />
        ))}
      </div>
    </div>
  );
}
