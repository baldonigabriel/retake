import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackLink } from "@/components/match/back-link";
import { MatchHeader } from "@/components/match/match-header";
import { ScoreboardTable } from "@/components/match/scoreboard-table";
import { requireViewer } from "@/lib/auth/session";
import { getMatchForViewer } from "@/lib/match/queries";
import { buildScoreboard } from "@/lib/match/scoreboard";

export const metadata: Metadata = {
  title: "Partida",
  description: "Placar completo da partida.",
};

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const { id } = await params;
  const { account } = await requireViewer(`/match/${id}`);
  const detail = await getMatchForViewer(decodeURIComponent(id), account.puuid);
  if (!detail) notFound();

  const board = buildScoreboard(detail.match, detail.players, account.puuid);

  return (
    <div className="flex flex-col gap-4 py-6 sm:py-8">
      <BackLink />
      <MatchHeader match={detail.match} board={board} />
      <div className="flex flex-col gap-4">
        {board.teams.map((team) => (
          <ScoreboardTable key={team.id} team={team} roundsPlayed={detail.match.roundsPlayed} headingLevel="h2" />
        ))}
      </div>
    </div>
  );
}
