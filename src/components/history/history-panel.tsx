import { Swords } from "lucide-react";

import { HistoryShell } from "@/components/history/history-shell";
import { MatchHistory } from "@/components/history/match-history";
import type { HistoryItem } from "@/components/history/history-row";
import { AgentAvatar } from "@/components/match/agent-avatar";
import { AnimatedNumber } from "@/components/stats/animated-number";
import { EmptyState } from "@/components/ui/states";
import { agentIconUrl } from "@/lib/assets";
import { formatNumber, formatPercent } from "@/lib/format";
import { HISTORY_PAGE, type HistoryOption, type HistorySummary } from "@/lib/stats/history";

function SummaryStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-eyebrow text-fg-muted uppercase">{label}</dt>
      <dd className="stat text-stat-md text-fg">{children}</dd>
    </div>
  );
}

/** "Últimas 20": V–D, win rate, K/D, ADR and the 3 most played agents with their own cut. */
export function HistorySummaryBlock({ summary, caption }: { summary: HistorySummary; caption: string }) {
  const { stats, topAgents } = summary;
  return (
    <div className="grid gap-5 border-b border-line p-4 sm:p-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-8">
      <div className="flex flex-col gap-3">
        <p className="text-eyebrow text-fg-muted uppercase">{caption}</p>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryStat label="V–D">
            <span className="sr-only">
              {stats.wins} vitórias, {stats.losses} derrotas{stats.draws ? `, ${stats.draws} empates` : ""}
            </span>
            <span aria-hidden="true" className="inline-flex items-baseline">
              <AnimatedNumber value={stats.wins} />–<AnimatedNumber value={stats.losses} />
              {stats.draws ? (
                <span className="ml-1 text-[18px] text-fg-muted">{stats.draws}E</span>
              ) : null}
            </span>
          </SummaryStat>
          <SummaryStat label="Vitórias">
            <AnimatedNumber value={stats.winRate * 100} digits={1} suffix="%" />
          </SummaryStat>
          <SummaryStat label="K/D">
            <AnimatedNumber value={stats.kd} digits={2} />
          </SummaryStat>
          <SummaryStat label="ADR">
            <AnimatedNumber value={Math.round(stats.adr)} />
          </SummaryStat>
        </dl>
      </div>
      {topAgents.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-eyebrow text-fg-muted uppercase">Mais jogados nesse recorte</p>
          <ul className="grid gap-2 sm:grid-cols-3">
            {topAgents.map((a) => (
              <li key={a.key} className="flex items-center gap-3 rounded-control bg-surface-2 px-3 py-2.5 shadow-hairline">
                <AgentAvatar agent={a.agentName} src={agentIconUrl(a.agentId)} />
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="truncate font-medium text-fg">{a.agentName}</p>
                  <p className="num text-label font-normal text-fg-secondary">
                    {a.matches} {a.matches === 1 ? "partida" : "partidas"} · {formatPercent(a.winRate, 0)} vit.
                  </p>
                  <p className="num text-label font-normal text-fg-muted">
                    K/D {formatNumber(a.kd, 2)} · ACS {formatNumber(Math.round(a.acs))}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * "Últimas partidas": summary of the filtered last 20, then the list by day
 * with filters by agent and map and "Carregar mais".
 */
export function HistoryPanel({
  title = "Últimas partidas",
  id = "history-title",
  summary,
  summaryCaption,
  items,
  total,
  now,
  hrefFor,
  agents,
  maps,
  agent,
  map,
  emptyAction,
  toolbarExtra,
  emptyDescription = "Troque o agente ou o mapa para ver suas outras partidas.",
  showRank = true,
}: {
  title?: string;
  id?: string;
  summary?: HistorySummary;
  summaryCaption?: string;
  items: readonly HistoryItem[];
  /** Matches after the filters (the list shows `items.length` of them) */
  total: number;
  now: Date;
  hrefFor: (item: HistoryItem) => string | null;
  agents?: readonly HistoryOption[];
  maps?: readonly HistoryOption[];
  agent?: string;
  map?: string;
  emptyAction?: React.ReactNode;
  /** Extra filter controls next to agent and map (e.g. the "com fulano" chip). */
  toolbarExtra?: React.ReactNode;
  emptyDescription?: string;
  /** false hides rank and RR in the rows (public profile with the rank hidden). */
  showRank?: boolean;
}) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id={id} className="text-body-sm font-semibold text-fg">
          {title}
        </h2>
        <span className="num text-label font-normal text-fg-muted">
          {items.length < total ? `${items.length} de ${total}` : `${total} ${total === 1 ? "partida" : "partidas"}`}
        </span>
      </header>
      <HistoryShell agents={agents} maps={maps} agent={agent} map={map} shown={items.length} total={total} pageSize={HISTORY_PAGE} toolbarExtra={toolbarExtra}>
        {total === 0 ? (
          <EmptyState
            icon={Swords}
            title="Nenhuma partida com esses filtros"
            description={emptyDescription}
            action={emptyAction}
          />
        ) : (
          <>
            {summary && summaryCaption ? <HistorySummaryBlock summary={summary} caption={summaryCaption} /> : null}
            <MatchHistory items={items} now={now} hrefFor={hrefFor} label={title} showRank={showRank} />
          </>
        )}
      </HistoryShell>
    </section>
  );
}
