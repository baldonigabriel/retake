import { CircleAlert, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AgentTable } from "@/components/dashboard/agent-table";
import { FilterBar, FilteredContent, FilterProvider } from "@/components/dashboard/dashboard-filters";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { MapGrid } from "@/components/dashboard/map-grid";
import { RankHeader } from "@/components/dashboard/rank-header";
import { RecentMatches } from "@/components/dashboard/recent-matches";
import { SyncNowButton } from "@/components/dashboard/sync-now-button";
import { GoalsPanel, GoalsPanelSkeleton } from "@/components/goals/goals-panel";
import { TrendChart } from "@/components/stats/trend-chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { SYNC_NOW_COOLDOWN_MS } from "@/lib/accounts/initial-import";
import { requireViewer } from "@/lib/auth/session";
import { getPlayerLines, getRankHistory } from "@/lib/dashboard/queries";
import { verdict } from "@/lib/dashboard/verdict";
import { formatRelativeTime } from "@/lib/format";
import { formatWeek, inWeek, previousWeek, weekRange } from "@/lib/groups/week";
import { modeAdjective, modeLabel } from "@/lib/modes";
import { ALL_MODES, DEFAULT_MODE, filterByMode } from "@/lib/stats";
import {
  DEFAULT_PERIOD,
  RECENT_WINDOW,
  byAgent,
  byMap,
  compareRecent,
  filterByPeriod,
  modeOptions,
  parseMode,
  parsePeriod,
  trendSeries,
  type Period,
} from "@/lib/stats/breakdown";
import { buildInsights } from "@/lib/stats/insights";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Painel",
  description: "Sua evolução no Valorant: rank, ACS, K/D, HS%, ADR e vitórias.",
};

export const maxDuration = 60;

const PERIOD_OPTIONS: readonly { value: Period; label: string }[] = [
  { value: "30d", label: "30 dias" },
  { value: "90d", label: "90 dias" },
  { value: "all", label: "Tudo" },
];
const PERIOD_PHRASE: Record<Period, string> = { "30d": "nos últimos 30 dias", "90d": "nos últimos 90 dias", all: "" };

const RECENT_LIST = 10;

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const { user, account } = await requireViewer("/me");
  const [params, allLines, rank] = await Promise.all([
    searchParams,
    getPlayerLines(account.puuid),
    getRankHistory(account.puuid),
  ]);
  const now = new Date();

  const options = modeOptions(allLines);
  const mode = parseMode(params.mode, options);
  const period = parsePeriod(params.period);
  const periodLines = filterByPeriod(allLines, period, now);
  const lines = filterByMode(periodLines, mode);

  const cmp = compareRecent(lines, mode);
  const trend = trendSeries(lines);
  const sentence = verdict(cmp, RECENT_WINDOW);
  const insights = buildInsights(lines, mode);
  const cooldownUntil = account.lastSyncedAt ? account.lastSyncedAt.getTime() + SYNC_NOW_COOLDOWN_MS : null;
  const mixed = mode === ALL_MODES;
  // Goals always use this São Paulo week, whatever the filters say.
  const week = weekRange(now);
  const lastWeek = previousWeek(week);

  return (
    <div className="content-enter flex flex-col gap-4 py-8 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-heading text-fg">
            <span className="truncate">{account.gameName}</span>
            <span className="font-mono text-body-sm font-normal text-fg-muted">#{account.tagLine}</span>
          </h1>
          <p className="max-w-[70ch] text-body-sm text-fg-secondary">
            {sentence ??
              (allLines.length > 0
                ? "Escolha outro modo ou período para ver se você está melhorando."
                : "Estou melhorando? Assim que suas partidas chegarem, a resposta aparece aqui.")}
          </p>
        </div>
        <div className="flex items-center gap-3 sm:shrink-0">
          <p className="num text-label font-normal text-fg-muted">
            {account.lastSyncedAt ? `Atualizado ${formatRelativeTime(account.lastSyncedAt, now)}` : "Ainda não sincronizado"}
          </p>
          {allLines.length > 0 ? <SyncNowButton cooldownUntil={cooldownUntil} /> : null}
        </div>
      </header>

      {account.syncStatus === "error" ? (
        <p role="alert" className="flex gap-2 rounded-control bg-loss-tint px-3 py-2.5 text-fg">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-loss" />
          O último sync falhou porque o serviço de dados do Valorant não respondeu. Tentamos de novo sozinhos em até 15
          minutos, ou use “Sincronizar agora”.
        </p>
      ) : null}

      <RankHeader history={rank} />

      {allLines.length > 0 ? (
        <Suspense fallback={<GoalsPanelSkeleton />}>
          <GoalsPanel
            userId={user.id}
            weekLines={allLines.filter((l) => inWeek(l.startedAt, week))}
            lastWeekLines={allLines.filter((l) => inWeek(l.startedAt, lastWeek))}
            weekLabel={formatWeek(week)}
          />
        </Suspense>
      ) : null}

      {allLines.length === 0 ? (
        <Panel>
          <EmptyState
            icon={Swords}
            title="Ainda não temos partidas suas"
            description="Jogue uma partida e ela aparece aqui em até 15 minutos. Se você acabou de jogar, sincronize agora."
            action={<SyncNowButton cooldownUntil={cooldownUntil} variant="default" />}
          />
        </Panel>
      ) : (
        <FilterProvider>
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <FilterBar
              modes={options.map((o) => ({ value: o.value, label: modeLabel(o.value) }))}
              mode={mode}
              defaultMode={DEFAULT_MODE}
              periods={PERIOD_OPTIONS}
              period={period}
              defaultPeriod={DEFAULT_PERIOD}
            />
            {mixed ? (
              <Badge variant="outline">Médias misturam todos os modos</Badge>
            ) : null}
          </div>

          <FilteredContent className="flex flex-col gap-4">
            {lines.length === 0 ? (
              <Panel>
                <EmptyState
                  icon={Swords}
                  title={`Nenhuma partida ${modeAdjective(mode)} ${PERIOD_PHRASE[period]}`.replace(/\s+/g, " ").trim()}
                  description="Troque o modo ou o período para ver suas outras partidas."
                  action={
                    <Link href={period !== DEFAULT_PERIOD ? `/me${mode !== DEFAULT_MODE ? `?mode=${mode}` : ""}` : "/me?mode=all"} className={buttonVariants()}>
                      {period !== DEFAULT_PERIOD ? "Ver todo o período" : "Ver todos os modos"}
                    </Link>
                  }
                />
              </Panel>
            ) : (
              <>
                <section aria-labelledby="kpi-title" className="flex flex-col gap-3">
                  <h2 id="kpi-title" className="text-eyebrow text-fg-muted uppercase">
                    {cmp.comparable ? `Últimas ${RECENT_WINDOW} partidas` : `${lines.length} ${lines.length === 1 ? "partida" : "partidas"}`}{" "}
                    · {modeLabel(mode)}
                  </h2>
                  <KpiRow cmp={cmp} trend={trend} />
                </section>

                {trend.length >= 2 ? (
                  <Panel title="Tendência" id="trend-title">
                    <div className="p-4 sm:p-5">
                      <TrendChart data={trend} />
                    </div>
                  </Panel>
                ) : null}

                <InsightsPanel result={insights} mode={mode} />

                <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
                  <Panel title="Por agente" id="agents-title" className="lg:col-span-7">
                    <AgentTable agents={byAgent(lines, mode)} />
                  </Panel>
                  <Panel title="Por mapa" id="maps-title" className="lg:col-span-5">
                    <MapGrid maps={byMap(lines, mode)} />
                  </Panel>
                </div>

                <Panel
                  title="Partidas recentes"
                  id="recent-title"
                  aside={
                    lines.length > RECENT_LIST ? (
                      <span className="num text-label font-normal text-fg-muted">
                        {RECENT_LIST} de {lines.length}
                      </span>
                    ) : null
                  }
                >
                  <RecentMatches lines={lines.slice(0, RECENT_LIST)} now={now} />
                </Panel>
              </>
            )}
          </FilteredContent>
        </FilterProvider>
      )}
    </div>
  );
}

function Panel({
  title,
  id,
  aside,
  className,
  children,
}: {
  title?: string;
  id?: string;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-labelledby={title ? id : undefined}
      className={cn("overflow-hidden rounded-card bg-surface-1 shadow-hairline", className)}
    >
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={id} className="text-body-sm font-semibold text-fg">
            {title}
          </h2>
          {aside}
        </header>
      ) : null}
      {children}
    </section>
  );
}
