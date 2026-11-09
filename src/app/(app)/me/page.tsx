import { ChevronRight, CircleAlert, Swords } from "lucide-react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";

import { AgentsPanel } from "@/components/agents/agents-panel";
import { DuosPanel, DuosPanelSkeleton } from "@/components/duos/duos-panel";
import { WithMateChip } from "@/components/duos/with-mate-chip";
import { HistoryPanel } from "@/components/history/history-panel";
import { MatchHistory } from "@/components/history/match-history";
import { FilterBar, FilteredContent, FilterProvider } from "@/components/dashboard/dashboard-filters";
import { DashboardTabs } from "@/components/dashboard/dashboard-tabs";
import { InsightsPanel } from "@/components/dashboard/insights-panel";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { MapGrid } from "@/components/dashboard/map-grid";
import { OverviewHighlights } from "@/components/dashboard/overview-highlights";
import { RankHeader } from "@/components/dashboard/rank-header";
import { SyncNowButton } from "@/components/dashboard/sync-now-button";
import { GoalsPanel, GoalsPanelSkeleton } from "@/components/goals/goals-panel";
import { ProfileQuestionCard } from "@/components/profile/profile-question-card";
import { BreakNote } from "@/components/session/break-note";
import { BREAK_DISMISSED_COOKIE } from "@/components/session/break-cookie";
import { SessionCard, SessionCardSkeleton } from "@/components/session/session-card";
import { TrendChart } from "@/components/stats/trend-chart";
import { RoundsPanel } from "@/components/rounds/rounds-panel";
import { WeaponsPanel } from "@/components/rounds/weapons-panel";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { SYNC_NOW_COOLDOWN_MS } from "@/lib/accounts/initial-import";
import { requireViewer } from "@/lib/auth/session";
import { withExtras } from "@/lib/dashboard/history";
import { getPlayerLines, getRankHistory } from "@/lib/dashboard/queries";
import { verdict } from "@/lib/dashboard/verdict";
import { getMateAppearances, getMates } from "@/lib/duos/queries";
import { formatRelativeTime } from "@/lib/format";
import { formatWeek, inWeek, previousWeek, weekRange } from "@/lib/groups/week";
import { modeAdjective, modeLabel } from "@/lib/modes";
import { filterBySeason, parseSeason, seasonOptions } from "@/lib/seasons";
import { getSeasonCatalog } from "@/lib/seasons-api";
import { ALL_MODES, DEFAULT_MODE, agentStats, filterByMode } from "@/lib/stats";
import {
  DEFAULT_PERIOD,
  RECENT_WINDOW,
  byMap,
  compareRecent,
  filterByPeriod,
  modeOptions,
  parseMode,
  parsePeriod,
  trendSeries,
  type Period,
} from "@/lib/stats/breakdown";
import { filterHistory, historyOptions, historySummary, parseHistoryFilter, parseShow, HISTORY_SUMMARY_WINDOW } from "@/lib/stats/history";
import { buildInsights } from "@/lib/stats/insights";
import { DASHBOARD_TABS, DEFAULT_TAB, bestMaps, parseTab, type DashboardTab } from "@/lib/stats/overview";
import { getBreakReminder } from "@/lib/preferences/queries";
import { calculatePlayerRoundMetrics } from "@/lib/rounds";
import { getRoundDataset } from "@/lib/rounds/queries";
import { currentSession, shouldSuggestBreak, summarizeSession } from "@/lib/stats/session";
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
/** Matches in the overview's "Partidas recentes". */
const RECENT_PREVIEW = 5;
/** Anchor of the tab row: links into a tab land on it, not at the top of the page. */
const TABS_ANCHOR = "secoes";

/**
 * "Estou melhorando?" The dashboard is split in tabs (?tab=) so each answer
 * is one click away instead of a long scroll: the overview keeps the summary
 * (rank, goals, KPIs, trend, highlights, insights and the last matches); the
 * other tabs hold the full sections. Only the data a tab shows is loaded.
 */
export default async function MePage({ searchParams }: PageProps<"/me">) {
  const { user, account } = await requireViewer("/me");
  const [params, allLines, rank, catalog] = await Promise.all([
    searchParams,
    getPlayerLines(account.puuid),
    getRankHistory(account.puuid),
    getSeasonCatalog(),
  ]);
  const now = new Date();

  const options = modeOptions(allLines);
  const mode = parseMode(params.mode, options);
  const period = parsePeriod(params.period);
  const periodLines = filterByPeriod(allLines, period, now);
  const lines = filterByMode(periodLines, mode);
  // ?with=<userId>: matches on the same team as a mate from your groups (validated here, never trusted).
  const withParam = typeof params.with === "string" && params.with.length <= 200 ? params.with : null;
  const tab = parseTab(params.tab, { withMate: withParam !== null });
  const show = (t: DashboardTab | readonly DashboardTab[]) => (typeof t === "string" ? tab === t : t.includes(tab));

  const roundMetrics = show(["overview", "combat"])
    ? calculatePlayerRoundMetrics({ puuid: account.puuid, ...(await getRoundDataset(lines.map((line) => line.matchId))) })
    : null;

  const cmp = compareRecent(lines, mode);
  const trend = trendSeries(lines);
  const sentence = verdict(cmp, RECENT_WINDOW);
  const insights = buildInsights(lines, mode);
  const seasons = seasonOptions(lines, catalog);
  const season = parseSeason(params.season, seasons);
  const agents = agentStats(filterBySeason(lines, season));
  const maps = byMap(lines, mode);
  // "Últimas partidas": its own agent/map filters and page size, on top of mode and period.
  const historyFilters = historyOptions(lines);
  const historyAgent = parseHistoryFilter(params.agent, historyFilters.agents);
  const historyMap = parseHistoryFilter(params.map, historyFilters.maps);
  const withMate = withParam && show("matches") ? await resolveMate(user.id, account.puuid, withParam) : null;
  const historyLines = filterHistory(lines, { agent: historyAgent, map: historyMap }).filter(
    (l) => !withMate || withMate.matchIds.has(l.matchId),
  );
  const historyItems = show("matches") ? await withExtras(account.puuid, historyLines.slice(0, parseShow(params.show))) : [];
  const recentItems = show("overview") ? await withExtras(account.puuid, lines.slice(0, RECENT_PREVIEW)) : [];

  // Filters (mode, period, season) follow you across tabs; the history's own filters don't.
  const query = (extra: Record<string, string | string[] | undefined>) =>
    new URLSearchParams(
      Object.entries({ mode: params.mode, period: params.period, season: params.season, ...extra }).flatMap(([k, v]) =>
        typeof v === "string" ? [[k, v]] : [],
      ),
    );
  const href = (extra: Record<string, string | string[] | undefined>, hash = "") => {
    const q = query(extra).toString();
    return `/me${q ? `?${q}` : ""}${hash}`;
  };
  const tabHref = (t: DashboardTab, hash = "") => href({ tab: t === DEFAULT_TAB ? undefined : t }, hash);
  const tabs = DASHBOARD_TABS.map((t) => ({ value: t.value, label: t.label, href: tabHref(t.value) }));

  const cooldownUntil = account.lastSyncedAt ? account.lastSyncedAt.getTime() + SYNC_NOW_COOLDOWN_MS : null;
  const mixed = mode === ALL_MODES;
  // Goals always use this São Paulo week, whatever the filters say.
  const week = weekRange(now);
  const lastWeek = previousWeek(week);
  // "Sessão de hoje" is about time, not filters: every mode, whatever the period says.
  const session = currentSession(allLines, now);
  // The break note: session going on, losses in a row, turned on, not closed for this session.
  const lossStreak = session ? summarizeSession(session.lines.map((l) => ({ ...l, rrChange: null }))).lossStreak : 0;
  const sessionKey = session?.lines[0]?.matchId ?? "";
  const suggestBreak =
    session !== null &&
    shouldSuggestBreak(session, { lossStreak }) &&
    (await cookies()).get(BREAK_DISMISSED_COOKIE)?.value !== sessionKey &&
    (await getBreakReminder(user.id));

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

      <Suspense fallback={null}>
        <ProfileQuestionCard userId={user.id} riotId={account} />
      </Suspense>

      {session ? (
        <Suspense fallback={<SessionCardSkeleton />}>
          <SessionCard
            puuid={account.puuid}
            session={session}
            note={suggestBreak ? <BreakNote sessionKey={sessionKey} losses={lossStreak} /> : null}
          />
        </Suspense>
      ) : null}

      {allLines.length === 0 ? (
        <>
          <RankHeader history={rank} />
          <Panel>
            <EmptyState
              icon={Swords}
              title="Ainda não temos partidas suas"
              description="Jogue uma partida e ela aparece aqui em até 15 minutos. Se você acabou de jogar, sincronize agora."
              action={<SyncNowButton cooldownUntil={cooldownUntil} variant="default" />}
            />
          </Panel>
        </>
      ) : (
        <FilterProvider>
          <div id={TABS_ANCHOR} className="scroll-mt-20">
            <DashboardTabs tabs={tabs} active={tab} />
          </div>

          {/* Rank and goals don't follow the filters: they sit above them. */}
          {tab === "overview" ? (
            <>
              <RankHeader history={rank} />
              <Suspense fallback={<GoalsPanelSkeleton />}>
                <GoalsPanel
                  userId={user.id}
                  weekLines={allLines.filter((l) => inWeek(l.startedAt, week))}
                  lastWeekLines={allLines.filter((l) => inWeek(l.startedAt, lastWeek))}
                  weekLabel={formatWeek(week)}
                />
              </Suspense>
            </>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <FilterBar
              modes={options.map((o) => ({ value: o.value, label: modeLabel(o.value) }))}
              mode={mode}
              defaultMode={DEFAULT_MODE}
              periods={PERIOD_OPTIONS}
              period={period}
              defaultPeriod={DEFAULT_PERIOD}
            />
            {mixed ? <Badge variant="outline">Médias misturam todos os modos</Badge> : null}
          </div>

          <FilteredContent className="flex flex-col gap-4">
            {lines.length === 0 ? (
              <Panel>
                <EmptyState
                  icon={Swords}
                  title={`Nenhuma partida ${modeAdjective(mode)} ${PERIOD_PHRASE[period]}`.replace(/\s+/g, " ").trim()}
                  description="Troque o modo ou o período para ver suas outras partidas."
                  action={
                    <Link
                      href={href({ tab: params.tab, mode: period !== DEFAULT_PERIOD ? params.mode : "all", period: undefined, season: undefined })}
                      className={buttonVariants()}
                    >
                      {period !== DEFAULT_PERIOD ? "Ver todo o período" : "Ver todos os modos"}
                    </Link>
                  }
                />
              </Panel>
            ) : tab === "overview" ? (
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

                <OverviewHighlights
                  agents={agents}
                  weapons={roundMetrics?.weapons ?? []}
                  maps={bestMaps(maps)}
                  rounds={roundMetrics!}
                  hrefs={{
                    agents: tabHref("agents", `#${TABS_ANCHOR}`),
                    combat: tabHref("combat", `#${TABS_ANCHOR}`),
                    maps: tabHref("maps", `#${TABS_ANCHOR}`),
                  }}
                  agentHref={(a) => (a.slug ? `/me/agents/${a.slug}` : null)}
                />

                <InsightsPanel result={insights} mode={mode} />

                <Panel
                  title="Partidas recentes"
                  id="recent-title"
                  aside={
                    <Link
                      href={tabHref("matches", `#${TABS_ANCHOR}`)}
                      className="hover-layer press relative -mr-2 inline-flex min-h-11 items-center gap-1 rounded-control px-2 text-label text-fg-secondary hover:text-fg focus-visible:text-fg sm:min-h-8"
                    >
                      Ver todas
                      <ChevronRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  }
                >
                  <MatchHistory items={recentItems} now={now} hrefFor={(item) => `/match/${item.matchId}`} label="Partidas recentes" />
                </Panel>
              </>
            ) : tab === "matches" ? (
              <HistoryPanel
                summary={historySummary(historyLines)}
                summaryCaption={`${historyLines.length > HISTORY_SUMMARY_WINDOW ? `Últimas ${HISTORY_SUMMARY_WINDOW}` : historyLines.length === 1 ? "1 partida" : `${historyLines.length} partidas`} · ${modeLabel(mode)}`}
                items={historyItems}
                total={historyLines.length}
                now={now}
                hrefFor={(item) => `/match/${item.matchId}`}
                agents={historyFilters.agents}
                maps={historyFilters.maps}
                agent={historyAgent}
                map={historyMap}
                toolbarExtra={
                  withMate ? (
                    <WithMateChip
                      name={withMate.name}
                      clearHref={href({ tab: "matches", agent: params.agent, map: params.map }, "#history-title")}
                    />
                  ) : undefined
                }
                emptyDescription={
                  withMate
                    ? `Nenhuma partida no mesmo time que ${withMate.name} com esses filtros. Troque o modo, o período, o agente ou o mapa.`
                    : undefined
                }
                emptyAction={
                  <Link href={href({ tab: "matches" })} className={buttonVariants()}>
                    Ver todas as partidas
                  </Link>
                }
              />
            ) : tab === "agents" ? (
              <AgentsPanel
                agents={agents}
                seasons={seasons}
                season={season}
                modeName={modeLabel(mode)}
                hrefFor={(a) => (a.slug ? `/me/agents/${a.slug}` : null)}
              />
            ) : tab === "maps" ? (
              <Panel title="Por mapa" id="maps-title">
                <MapGrid maps={maps} className="lg:grid-cols-4" />
              </Panel>
            ) : tab === "combat" ? (
              <>
                <RoundsPanel metrics={roundMetrics!} />
                <WeaponsPanel weapons={roundMetrics!.weapons} />
              </>
            ) : (
              <Suspense fallback={<DuosPanelSkeleton />}>
                <DuosPanel
                  viewerId={user.id}
                  viewerPuuid={account.puuid}
                  lines={lines}
                  mode={mode}
                  scope="groups"
                  hrefFor={(mate) => href({ tab: "matches", with: mate.userId }, "#history-title")}
                />
              </Suspense>
            )}
          </FilteredContent>
        </FilterProvider>
      )}
    </div>
  );
}

/** A mate from the viewer's groups and the matches they shared a team in; null for anyone else. */
async function resolveMate(viewerId: string, viewerPuuid: string, mateUserId: string) {
  const [mates, all] = await Promise.all([getMates(viewerId), getMateAppearances(viewerId, viewerPuuid)]);
  const mate = mates.find((m) => m.userId === mateUserId);
  if (!mate) return null;
  const appearances = all.get(mate.puuid) ?? [];
  return { name: mate.name, matchIds: new Set(appearances.map((a) => a.matchId)) };
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
