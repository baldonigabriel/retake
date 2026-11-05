import { StaggerList } from "@/components/dashboard/stagger-list";
import { MatchRow } from "@/components/match/match-row";
import { agentIconUrl } from "@/lib/assets";
import { modeLabel } from "@/lib/modes";
import { matchResult, playerScore, type DashboardLine } from "@/lib/stats/breakdown";

export function RecentMatches({ lines, now }: { lines: readonly DashboardLine[]; now: Date }) {
  return (
    <StaggerList aria-label="Partidas recentes" className="divide-y divide-line">
      {lines.map((l, i) => {
        const score = playerScore(l);
        return (
          <li key={l.matchId} style={{ "--i": i } as React.CSSProperties}>
            <MatchRow
              now={now}
              match={{
                id: l.matchId,
                result: matchResult(l),
                map: l.mapName ?? "Mapa desconhecido",
                mode: modeLabel(l.queueId, l.mode),
                agent: l.agentName ?? "Agente",
                agentIcon: agentIconUrl(l.agentId),
                kills: l.kills,
                deaths: l.deaths,
                assists: l.assists,
                score: l.score,
                rounds: l.roundsPlayed,
                teamScore: score.own,
                enemyScore: score.enemy,
                playedAt: l.startedAt,
              }}
            />
          </li>
        );
      })}
    </StaggerList>
  );
}
