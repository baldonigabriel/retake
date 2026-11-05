import Link from "next/link";

import { AgentAvatar } from "@/components/match/agent-avatar";
import { RESULT_LABEL, RESULT_LETTER } from "@/components/stats/result-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { formatNumber, formatRelativeTime } from "@/lib/format";
import type { MatchResult } from "@/lib/stats/metrics";
import { acs } from "@/lib/stats/metrics";
import { cn } from "@/lib/utils";

export type MatchRowData = {
  id: string;
  result: MatchResult;
  map: string;
  mode: string;
  agent: string;
  agentIcon?: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  rounds: number;
  teamScore: number;
  enemyScore: number;
  playedAt: Date;
};

const BAR: Record<MatchResult, string> = { win: "bg-win", loss: "bg-loss", draw: "bg-draw" };
const LETTER: Record<MatchResult, string> = { win: "text-win", loss: "text-loss", draw: "text-draw" };

/**
 * DESIGN.md › Linha de partida: 64px, 3px result bar, V/D/E letter, 36px agent,
 * map + mode, K/D/A in Geist Mono, ACS, score and relative time. Whole row clickable.
 */
export function MatchRow({
  match,
  now,
  className,
  style,
}: {
  match: MatchRowData;
  /** Reference time for "há 2 h" (injected for determinism) */
  now: Date;
  className?: string;
  style?: React.CSSProperties;
}) {
  const matchAcs = Math.round(acs(match.score, match.rounds));
  const when = formatRelativeTime(match.playedAt, now);
  const kda = `${match.kills}/${match.deaths}/${match.assists}`;

  return (
    <Link
      href={`/match/${match.id}`}
      style={style}
      aria-label={`${RESULT_LABEL[match.result]} em ${match.map}, ${match.teamScore} a ${match.enemyScore}, ${match.agent}, ${kda}, ACS ${matchAcs}, ${when}`}
      className={cn(
        "group relative flex h-16 items-center gap-3 pr-3 pl-3 transition-colors duration-150 ease-out hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-offset-[-2px] sm:gap-4 sm:pr-4",
        className,
      )}
    >
      <span aria-hidden="true" className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", BAR[match.result])} />
      <span aria-hidden="true" className={cn("stat w-4 text-center text-[22px] leading-none font-bold", LETTER[match.result])}>
        {RESULT_LETTER[match.result]}
      </span>
      <AgentAvatar agent={match.agent} src={match.agentIcon} />
      <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-fg">{match.map}</span>
        <span className="truncate text-label font-normal text-fg-muted">
          {match.mode}
          <span className="font-mono sm:hidden"> · {kda}</span>
        </span>
      </span>
      <span aria-hidden="true" className="hidden w-24 font-mono text-table text-fg-secondary sm:block">
        {kda}
      </span>
      <span aria-hidden="true" className="flex w-14 flex-col items-end sm:w-16">
        <span className="stat text-[24px] leading-none font-semibold text-fg">{formatNumber(matchAcs)}</span>
        <span className="text-eyebrow text-fg-muted uppercase">ACS</span>
      </span>
      <span aria-hidden="true" className="flex w-16 flex-col items-end gap-0.5 sm:w-28 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
        <span className="num text-body-sm font-medium text-fg">
          {match.teamScore}–{match.enemyScore}
        </span>
        <span className="num text-label whitespace-nowrap text-fg-muted">{when}</span>
      </span>
    </Link>
  );
}

export function MatchRowSkeleton() {
  return (
    <div className="flex h-16 items-center gap-3 px-3 sm:gap-4 sm:px-4" aria-hidden="true">
      <Skeleton className="h-5 w-4" />
      <Skeleton className="size-9 rounded-full" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="hidden h-3.5 w-16 sm:block" />
      <Skeleton className="h-6 w-10" />
      <Skeleton className="h-3.5 w-14" />
    </div>
  );
}
