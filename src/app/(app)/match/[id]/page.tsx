import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/match/back-link";
import { MatchHeader } from "@/components/match/match-header";
import { ScoreboardTable } from "@/components/match/scoreboard-table";
import { requireViewer } from "@/lib/auth/session";
import { getGroupMatePuuids } from "@/lib/groups/queries";
import { getMatchForViewer, getMatchRrForUsers } from "@/lib/match/queries";
import { buildScoreboard } from "@/lib/match/scoreboard";

export const metadata: Metadata = {
  title: "Partida",
  description: "Placar completo da partida.",
};

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const { id } = await params;
  const { user, account } = await requireViewer(`/match/${id}`);
  const [detail, mates] = await Promise.all([
    getMatchForViewer(decodeURIComponent(id), account.puuid),
    getGroupMatePuuids(user.id),
  ]);
  if (!detail) notFound();

  const board = buildScoreboard(detail.match, detail.players, account.puuid);
  const competitive = detail.match.queueId === "competitive";
  // RR only for Retake users; everyone else shows just the rank they had.
  const rr = competitive ? await getMatchRrForUsers(detail.match.id, detail.players.map((p) => p.puuid)) : new Map<string, number | null>();
  // Members of the viewer's groups get a discreet "grupo" badge (DESIGN.md › Placar).
  const teams = board.teams.map((t) => ({
    ...t,
    players: t.players.map((p) => ({ ...p, inGroup: !p.isYou && mates.has(p.id), rr: rr.has(p.id) ? rr.get(p.id) : undefined })),
  }));

  return (
    <div className="content-enter flex flex-col gap-4 py-6 sm:py-8">
      <BackLink />
      <MatchHeader match={detail.match} board={board} />
      <div className="flex flex-col gap-4">
        {teams.map((team) => (
          <ScoreboardTable key={team.id} team={team} roundsPlayed={detail.match.roundsPlayed} headingLevel="h2" showRr={competitive} />
        ))}
      </div>
    </div>
  );
}
