import { Star } from "lucide-react";
import Link from "next/link";

import { StaggerList } from "@/components/dashboard/stagger-list";
import { AgentAvatar } from "@/components/match/agent-avatar";
import { RESULT_LABEL, RESULT_LETTER } from "@/components/stats/result-chip";
import { agentIconUrl } from "@/lib/assets";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import type { TogetherMatch } from "@/lib/groups/ranking";
import { modeLabel } from "@/lib/modes";
import type { MatchResult } from "@/lib/stats/metrics";
import { cn } from "@/lib/utils";

const BAR: Record<MatchResult, string> = { win: "bg-win", loss: "bg-loss", draw: "bg-draw" };
const LETTER: Record<MatchResult, string> = { win: "text-win", loss: "text-loss", draw: "text-draw" };

/**
 * Matches where 2+ members were on the same team. Each row: result (bar +
 * letter + text for screen readers), map, mode, when, score, and the members
 * with their ACS; the best one is marked "destaque". A row links to the match
 * page only when the viewer played in it (the match page is for players only).
 */
export function TogetherList({ matches, now }: { matches: readonly TogetherMatch[]; now: Date }) {
  return (
    <StaggerList aria-label="Partidas que jogaram juntos" className="divide-y divide-line">
      {matches.map((m, i) => {
        const youPlayed = m.players.some((p) => p.member.isYou);
        const when = formatRelativeTime(m.startedAt, now);
        const body = (
          <>
            <span aria-hidden="true" className={cn("absolute inset-y-3 left-0 w-[3px] rounded-r-full", BAR[m.result])} />
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className={cn("stat w-4 text-center text-[22px] leading-none font-bold", LETTER[m.result])}>
                {RESULT_LETTER[m.result]}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate font-medium text-fg">
                  <span className="sr-only">{RESULT_LABEL[m.result]} em </span>
                  {m.mapName ?? "Mapa desconhecido"}
                </span>
                <span className="num truncate text-label font-normal text-fg-muted">
                  {modeLabel(m.queueId, m.mode)} · {when}
                </span>
              </span>
              <span className="num shrink-0 text-body-sm font-medium text-fg">
                {m.own}–{m.enemy}
              </span>
            </div>
            <ul aria-label="Membros na partida" className="flex flex-wrap gap-x-4 gap-y-2 pl-7">
              {m.players.map((p) => {
                const standout = p === m.standout;
                return (
                  <li key={p.member.userId} className="flex min-w-0 items-center gap-2">
                    <AgentAvatar agent={p.agentName ?? "Agente"} src={agentIconUrl(p.agentId)} size={24} />
                    <span className={cn("max-w-[10rem] truncate text-body-sm", standout ? "font-medium text-fg" : "text-fg-secondary")}>
                      {p.member.name}
                      {p.member.isYou ? <span className="sr-only"> (você)</span> : null}
                    </span>
                    <span className="num text-label font-normal text-fg-muted">
                      {formatNumber(Math.round(p.acs))} ACS
                    </span>
                    {standout && m.players.length > 1 ? (
                      <span className="inline-flex items-center gap-1 rounded-chip bg-surface-3 px-1.5 py-0.5 text-label text-fg-secondary">
                        <Star aria-hidden="true" className="size-3 fill-current text-primary" />
                        destaque
                      </span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </>
        );
        return (
          <li key={`${m.matchId}-${m.players[0]!.member.userId}`} style={{ "--i": i } as React.CSSProperties}>
            {youPlayed ? (
              <Link
                href={`/match/${m.matchId}`}
                className="relative flex flex-col gap-2 py-3 pr-4 pl-3 transition-colors duration-150 ease-out hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-offset-[-2px]"
              >
                {body}
              </Link>
            ) : (
              <div className="relative flex flex-col gap-2 py-3 pr-4 pl-3">{body}</div>
            )}
          </li>
        );
      })}
    </StaggerList>
  );
}
