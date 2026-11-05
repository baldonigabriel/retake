import { AgentAvatar } from "@/components/match/agent-avatar";
import { RESULT_LABEL } from "@/components/stats/result-chip";
import { ChamferCard } from "@/components/ui/chamfer-card";
import { agentIconUrl, mapSplashUrl, mapThumbUrl } from "@/lib/assets";
import { formatDuration, formatMatchDate, formatNumber, formatPercent } from "@/lib/format";
import { modeLabel } from "@/lib/modes";
import type { Scoreboard } from "@/lib/match/scoreboard";
import { acs, adr, hsRate } from "@/lib/stats/metrics";
import { cn } from "@/lib/utils";

type MatchInfo = {
  mapId: string | null;
  mapName: string | null;
  queueId: string;
  mode: string | null;
  startedAt: Date;
  gameLengthMs: number | null;
  roundsPlayed: number;
};

const RESULT_BAR = { win: "bg-win", loss: "bg-loss", draw: "bg-draw" } as const;

/**
 * DESIGN.md › result at the top of the match page: the screen's one
 * chamfered card, map splash behind a surface-0 85% overlay, result in text
 * (never colour alone), score, map, mode, date and duration; then the
 * viewer's own line.
 */
export function MatchHeader({ match, board }: { match: MatchInfo; board: Scoreboard }) {
  const splash = mapSplashUrl(match.mapId);
  // The splash is ~2 MB: phones get the 65 KB strip (display:none skips the download).
  const thumb = mapThumbUrl(match.mapId);
  const { you } = board;
  const stats = [
    { label: "K/D/A", value: `${you.kills}/${you.deaths}/${you.assists}`, mono: true },
    { label: "ACS", value: formatNumber(Math.round(acs(you.score, match.roundsPlayed))) },
    { label: "ADR", value: formatNumber(Math.round(adr(you.damageDealt, match.roundsPlayed))) },
    { label: "HS%", value: formatPercent(hsRate(you.headshots, you.bodyshots, you.legshots), 0) },
  ];

  return (
    <ChamferCard innerClassName="relative isolate overflow-hidden p-0 sm:p-0">
      {thumb ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-cover bg-center sm:hidden"
          style={{ backgroundImage: `url(${thumb})` }}
        />
      ) : null}
      {splash ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 hidden bg-cover bg-center sm:block"
          style={{ backgroundImage: `url(${splash})` }}
        />
      ) : null}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-surface-0/85" />

      <div className="flex flex-col gap-5 p-4 sm:flex-row sm:items-end sm:justify-between sm:p-6">
        <div className="flex flex-col gap-2">
          <h1 className="flex items-center gap-4">
            <span aria-hidden="true" className={cn("h-10 w-[3px] shrink-0 rounded-full", RESULT_BAR[board.result])} />
            <span className="stat text-stat-lg text-fg uppercase">{RESULT_LABEL[board.result]}</span>
            <span className="stat text-stat-lg text-fg">
              {board.own}
              <span className="text-fg-muted">–</span>
              {board.enemy}
            </span>
          </h1>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-label font-normal text-fg-secondary">
            <span className="font-medium text-fg">{match.mapName ?? "Mapa desconhecido"}</span>
            <span>{modeLabel(match.queueId, match.mode)}</span>
            <time dateTime={match.startedAt.toISOString()}>{formatMatchDate(match.startedAt)}</time>
            {match.gameLengthMs ? (
              <span className="font-mono">
                <span className="sr-only">duração </span>
                {formatDuration(match.gameLengthMs)}
              </span>
            ) : null}
            <span className="num">{match.roundsPlayed} rounds</span>
          </p>
        </div>

        <div className="flex items-center gap-4 border-t border-line pt-4 sm:border-t-0 sm:pt-0">
          <AgentAvatar agent={you.agentName ?? "Agente"} src={agentIconUrl(you.agentId)} />
          <dl className="grid flex-1 grid-cols-[auto_repeat(3,minmax(0,1fr))] gap-x-5 sm:flex-none sm:gap-x-6">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col gap-1">
                <dt className="text-eyebrow whitespace-nowrap text-fg-secondary uppercase">{s.label}</dt>
                <dd
                  className={cn(
                    "leading-none whitespace-nowrap text-fg",
                    s.mono ? "num font-mono text-body-sm leading-[24px] font-medium" : "stat text-[24px] font-semibold",
                  )}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </ChamferCard>
  );
}
