import Image from "next/image";
import Link from "next/link";

import { AgentAvatar } from "@/components/match/agent-avatar";
import { RESULT_LABEL, RESULT_LETTER } from "@/components/stats/result-chip";
import { Skeleton } from "@/components/ui/skeleton";
import { agentIconUrl } from "@/lib/assets";
import { formatNumber, formatPercent, formatRelativeTime, formatSigned } from "@/lib/format";
import { modeLabel } from "@/lib/modes";
import { tierIconUrl, tierLabel } from "@/lib/ranks";
import { matchResult, playerScore, type DetailedLine } from "@/lib/stats/breakdown";
import { acs, ddDelta, hsRate, type MatchResult } from "@/lib/stats/metrics";
import { cn } from "@/lib/utils";

export interface HistoryItem extends DetailedLine {
  tier: number | null;
  teamPosition: number | null;
  teamSize: number;
  rrChange: number | null;
}

const BAR: Record<MatchResult, string> = { win: "bg-win", loss: "bg-loss", draw: "bg-draw" };
const LETTER: Record<MatchResult, string> = { win: "text-win", loss: "text-loss", draw: "text-draw" };

/** "+18 RR" / "−15 RR" / "0 RR" / "RR indisponível"; null outside competitive. */
export function rrText(item: Pick<HistoryItem, "queueId" | "rrChange">): string | null {
  if (item.queueId !== "competitive") return null;
  if (item.rrChange === null) return "RR indisponível";
  return `${formatSigned(item.rrChange, 0)} RR`;
}

/**
 * RR won or lost in the match. The sign, an arrow and the word "RR" carry
 * the meaning; colour only repeats it. Unknown RR is "—", never an estimate.
 */
export function RrDelta({ value, className }: { value: number | null; className?: string }) {
  if (value === null) {
    return (
      <span className={cn("num text-label text-fg-muted", className)} title="O serviço de dados não informou o RR desta partida">
        <span aria-hidden="true">— RR</span>
        <span className="sr-only">RR indisponível</span>
      </span>
    );
  }
  const direction = value > 0 ? "up" : value < 0 ? "down" : "flat";
  return (
    <span
      className={cn(
        "num inline-flex items-center gap-1 text-label font-semibold whitespace-nowrap",
        direction === "up" ? "text-win" : direction === "down" ? "text-loss" : "text-fg-muted",
        className,
      )}
    >
      <span aria-hidden="true" className="text-[9px] leading-none">
        {direction === "up" ? "▲" : direction === "down" ? "▼" : "■"}
      </span>
      {formatSigned(value, 0)}
      <span className="font-medium text-fg-muted">RR</span>
    </span>
  );
}

/** Rank the player had in that match (match_players.tier), with its name for screen readers and on hover. */
export function TierIcon({ tier, size = 24 }: { tier: number | null; size?: 16 | 20 | 24 }) {
  const src = tierIconUrl(tier);
  const label = tierLabel(tier);
  if (!src) return <span className="sr-only">{label}</span>;
  return <Image src={src} alt={label} title={label} width={size} height={size} className="shrink-0" />;
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <span aria-hidden="true" className={cn("hidden flex-col items-end md:flex", className)}>
      <span className="num text-table leading-tight text-fg">{value}</span>
      <span className="text-eyebrow text-fg-muted uppercase">{label}</span>
    </span>
  );
}

/**
 * One match in the history. Desktop: a 64px row (DESIGN.md › Linha de
 * partida) with rank + RR, score + team place, K/D/A, HS%, DDΔ and ACS.
 * 390px: the same facts on three short lines. The whole row links to the
 * match when `href` is set; otherwise it's static (no hover, no press).
 */
export function HistoryRow({ item, now, href }: { item: HistoryItem; now: Date; href: string | null }) {
  const result = matchResult(item);
  const score = playerScore(item);
  const matchAcs = Math.round(acs(item.score, item.roundsPlayed));
  const hs = formatPercent(hsRate(item.headshots, item.bodyshots, item.legshots), 0);
  const dd = formatSigned(ddDelta(item.damageDealt, item.damageReceived, item.roundsPlayed), 0);
  const kda = `${item.kills}/${item.deaths}/${item.assists}`;
  const map = item.mapName ?? "Mapa desconhecido";
  const agent = item.agentName ?? "Agente";
  const mode = modeLabel(item.queueId, item.mode);
  const when = formatRelativeTime(item.startedAt, now);
  const place = item.teamPosition !== null && item.teamSize > 1 ? `${item.teamPosition}º` : null;
  const rr = rrText(item);
  const competitive = item.queueId === "competitive";

  const label = [
    `${RESULT_LABEL[result]} em ${map}`,
    mode,
    `${score.own} a ${score.enemy}`,
    agent,
    competitive ? `rank ${tierLabel(item.tier)}` : null,
    rr,
    place ? `${place} do time em ACS` : null,
    `${item.kills} abates, ${item.deaths} mortes, ${item.assists} assistências`,
    `HS ${hs}`,
    `DDΔ ${dd}`,
    `ACS ${matchAcs}`,
    when,
  ]
    .filter(Boolean)
    .join(", ");

  const body = (
    <>
      <span aria-hidden="true" className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", BAR[result])} />
      <span aria-hidden="true" className={cn("stat w-4 shrink-0 text-center text-[22px] leading-none font-bold", LETTER[result])}>
        {RESULT_LETTER[result]}
      </span>
      <AgentAvatar agent={agent} src={agentIconUrl(item.agentId)} className="max-md:size-8" />
      <span aria-hidden="true" className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-medium text-fg">{map}</span>
        <span className="truncate text-label font-normal text-fg-muted">
          {mode} · {when}
        </span>
      </span>
      <span aria-hidden="true" className="flex shrink-0 flex-col items-end gap-1.5 md:contents">
        <span aria-hidden="true" className="flex items-center justify-end gap-1.5 md:w-28">
          {competitive ? <TierIcon tier={item.tier} /> : null}
          {competitive ? <RrDelta value={item.rrChange} /> : null}
        </span>
        <span aria-hidden="true" className="flex items-baseline justify-end gap-1.5 md:w-20 md:flex-col md:items-end md:gap-0">
          <span className="num text-body-sm font-medium whitespace-nowrap text-fg">
            {score.own}–{score.enemy}
          </span>
          {place ? (
            <span className="num text-label font-normal whitespace-nowrap text-fg-muted">
              {place}
              <span className="max-md:hidden"> no time</span>
            </span>
          ) : null}
        </span>
      </span>
      {/* 390px: the per-match numbers get their own full-width line under the map. */}
      <span aria-hidden="true" className="num order-last w-full truncate pl-[72px] text-label font-normal text-fg-secondary sm:pl-[80px] md:hidden">
        <span className="font-medium text-fg">ACS {matchAcs}</span> · <span className="font-mono">{kda}</span> · HS {hs} · DDΔ {dd}
      </span>
      <Stat label="K/D/A" value={kda} className="w-20 [&>span:first-child]:font-mono" />
      <Stat label="HS%" value={hs} className="w-11" />
      <Stat label="DDΔ" value={dd} className="w-11" />
      <span aria-hidden="true" className="hidden w-12 flex-col items-end md:flex">
        <span className="stat text-[24px] leading-none font-semibold text-fg">{formatNumber(matchAcs)}</span>
        <span className="text-eyebrow text-fg-muted uppercase">ACS</span>
      </span>
    </>
  );

  const layout =
    "relative flex min-h-[76px] flex-wrap items-center gap-x-3 gap-y-1 py-2.5 pr-3 pl-3 sm:gap-x-4 sm:pr-4 md:h-16 md:min-h-0 md:flex-nowrap md:py-0";
  if (!href) {
    return (
      <div role="group" aria-label={label} className={layout}>
        {body}
      </div>
    );
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(layout, "group hover-layer press [--press-scale:0.99] focus-visible:outline-offset-[-2px]")}
    >
      {body}
    </Link>
  );
}

export function HistoryRowSkeleton() {
  return (
    <div className="flex min-h-[76px] items-center gap-3 px-3 sm:gap-4 sm:px-4 md:h-16 md:min-h-0" aria-hidden="true">
      <Skeleton className="h-5 w-4" />
      <Skeleton className="size-8 rounded-full md:size-9" />
      <div className="flex flex-1 flex-col gap-1.5">
        <Skeleton className="h-3.5 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-4 w-16" />
      <Skeleton className="hidden h-6 w-48 md:block" />
    </div>
  );
}
