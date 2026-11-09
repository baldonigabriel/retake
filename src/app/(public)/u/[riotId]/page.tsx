import { Settings2, Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentsPanel } from "@/components/agents/agents-panel";
import { FilteredContent, FilterProvider } from "@/components/dashboard/dashboard-filters";
import { KpiRow } from "@/components/dashboard/kpi-row";
import { MapGrid } from "@/components/dashboard/map-grid";
import { RankHeader } from "@/components/dashboard/rank-header";
import { GroupFilter } from "@/components/groups/group-filters";
import { HistoryPanel } from "@/components/history/history-panel";
import { WeaponsPanel } from "@/components/rounds/weapons-panel";
import { TrendChart } from "@/components/stats/trend-chart";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { getLinkedAccount, getSessionUser } from "@/lib/auth/session";
import { withExtras } from "@/lib/dashboard/history";
import { getPlayerLines, getRankHistory } from "@/lib/dashboard/queries";
import { matchHref } from "@/lib/match/access";
import { modeLabel } from "@/lib/modes";
import { parseProfileSlug, profilePath } from "@/lib/profile/path";
import { findPublicProfile, type PublicProfile } from "@/lib/profile/queries";
import { calculatePlayerRoundMetrics } from "@/lib/rounds";
import { getRoundDataset } from "@/lib/rounds/queries";
import { filterBySeason, parseSeason, seasonOptions } from "@/lib/seasons";
import { getSeasonCatalog } from "@/lib/seasons-api";
import { ALL_MODES, DEFAULT_MODE, filterByMode } from "@/lib/stats/aggregate";
import { agentStats } from "@/lib/stats/agents";
import { RECENT_WINDOW, byMap, compareRecent, modeOptions, parseMode, trendSeries } from "@/lib/stats/breakdown";
import {
  HISTORY_SUMMARY_WINDOW,
  filterHistory,
  historyOptions,
  historySummary,
  parseHistoryFilter,
  parseShow,
} from "@/lib/stats/history";

/**
 * Resolves the segment to a visible profile, or null. Private profiles,
 * players who aren't users and names that don't exist all come back null and
 * get the very same 404 (and the same metadata).
 */
async function resolve(raw: string): Promise<PublicProfile | null> {
  const parts = parseProfileSlug(raw);
  return parts ? findPublicProfile(parts) : null;
}

/**
 * Built from the address only, never from the database: the tab says the
 * same thing for a public, a private and an unknown Riot ID, so it can't be
 * used to tell them apart. (Reading the profile here also kept the 404 from
 * replacing the loading skeleton under Cache Components.)
 */
export async function generateMetadata({ params }: PageProps<"/u/[riotId]">): Promise<Metadata> {
  const parts = parseProfileSlug((await params).riotId);
  return {
    title: parts ? `${parts.gameName}#${parts.tagLine}` : "Perfil",
    description: "Perfil público no Retake.",
    // Shared, not indexed (SPEC §6.1).
    robots: { index: false, follow: false },
  };
}

/**
 * Public profile (SPEC §6.3): "how does this person play?". Works signed
 * out and shows only the sections the owner chose. Never shows groups,
 * Bagre, duos, goals, today's session or the weekly summary, and nothing
 * live. Matches show only the owner's own line; they open the full
 * scoreboard for any signed-in viewer (src/lib/match/access.ts).
 */
export default async function PublicProfilePage({ params, searchParams }: PageProps<"/u/[riotId]">) {
  const [{ riotId }, query] = await Promise.all([params, searchParams]);
  const profile = await resolve(riotId);
  if (!profile) notFound();
  const { settings } = profile;

  const viewer = await getSessionUser();
  const viewerAccount = viewer ? await getLinkedAccount(viewer.id) : null;
  const isOwner = viewer?.id === profile.userId;
  const needsLines = settings.showOverview || settings.showAgents || settings.showMaps || settings.showMatches || settings.showWeapons;

  const [allLines, rank, catalog] = await Promise.all([
    needsLines ? getPlayerLines(profile.puuid) : Promise.resolve([]),
    settings.showRank ? getRankHistory(profile.puuid) : Promise.resolve([]),
    settings.showAgents ? getSeasonCatalog() : Promise.resolve(undefined),
  ]);

  const modes = modeOptions(allLines);
  const mode = parseMode(query.mode, modes);
  const lines = filterByMode(allLines, mode);
  const weaponMetrics = settings.showWeapons
    ? calculatePlayerRoundMetrics({
        puuid: profile.puuid,
        ...(await getRoundDataset(lines.map((line) => line.matchId))),
      }).weapons
    : [];
  const cmp = compareRecent(lines, mode);
  const trend = trendSeries(lines);
  const seasons = settings.showAgents && catalog ? seasonOptions(lines, catalog) : [];
  const season = parseSeason(query.season, seasons);
  const agents = settings.showAgents ? agentStats(filterBySeason(lines, season)) : [];

  const filters = historyOptions(lines);
  const agent = parseHistoryFilter(query.agent, filters.agents);
  const map = parseHistoryFilter(query.map, filters.maps);
  const historyLines = settings.showMatches ? filterHistory(lines, { agent, map }) : [];
  const rawItems = settings.showMatches ? await withExtras(profile.puuid, historyLines.slice(0, parseShow(query.show))) : [];
  // Rank and RR hidden by the owner never leave the server.
  const items = settings.showRank ? rawItems : rawItems.map((i) => ({ ...i, tier: null, rrChange: null }));
  // A public profile that shows matches opens each one's full scoreboard for any
  // signed-in viewer with a Riot ID (src/lib/match/access.ts); visitors get plain rows.
  const canOpenMatches = viewerAccount !== null;
  const now = new Date();
  const name = profile.gameName;

  return (
    <div className="content-enter flex flex-col gap-4 py-6 sm:py-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <span className="size-14 shrink-0 overflow-hidden rounded-control bg-surface-3 shadow-hairline">
            {profile.cardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- community player card asset
              <img src={profile.cardUrl} alt="" width={56} height={56} className="size-full object-cover" />
            ) : null}
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-heading text-fg">
              <span className="truncate">{name}</span>
              <span className="font-mono text-body-sm font-normal text-fg-muted">#{profile.tagLine}</span>
            </h1>
            <p className="text-body-sm text-fg-secondary">Perfil público no Retake</p>
          </div>
        </div>
        {isOwner ? (
          <p className="flex items-center gap-2 text-label font-normal text-fg-muted">
            É assim que visitantes veem seu perfil.
            <Link href="/settings#perfil" className="inline-flex min-h-11 items-center gap-1 text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg sm:min-h-0">
              <Settings2 aria-hidden="true" className="size-3.5" />
              Mudar
            </Link>
          </p>
        ) : !viewer ? (
          <p className="text-label font-normal text-fg-muted">
            Quer um perfil assim?{" "}
            <Link
              href={`/login?next=${encodeURIComponent(profilePath(profile))}`}
              className="inline-flex min-h-11 items-center text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg sm:min-h-0"
            >
              Entre no Retake
            </Link>
          </p>
        ) : null}
      </header>

      {settings.showRank ? <RankHeader history={rank} emptyHint={`${name} ainda não tem competitivas com rank no Retake.`} /> : null}

      {needsLines ? (
        allLines.length === 0 ? (
          <Panel>
            <EmptyState
              icon={Swords}
              title={`Ainda não temos partidas de ${name}`}
              description="As partidas aparecem aqui depois que essa pessoa joga e o Retake sincroniza, em até 15 minutos."
            />
          </Panel>
        ) : (
          <FilterProvider>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <GroupFilter
                name="mode"
                label="Modo"
                options={modes.map((o) => ({ value: o.value, label: modeLabel(o.value) }))}
                value={mode}
                fallback={DEFAULT_MODE}
              />
              {mode === ALL_MODES ? <Badge variant="outline">Médias misturam todos os modos</Badge> : null}
            </div>
            <FilteredContent className="flex flex-col gap-4">
              {lines.length === 0 ? (
                <Panel>
                  <EmptyState
                    icon={Swords}
                    title={`Nenhuma partida de ${name} nesse modo`}
                    description="Troque o modo acima para ver as outras partidas."
                  />
                </Panel>
              ) : (
                <>
                  {settings.showOverview ? (
                    <section aria-labelledby="kpi-title" className="flex flex-col gap-3">
                      <h2 id="kpi-title" className="text-eyebrow text-fg-muted uppercase">
                        {cmp.comparable ? `Últimas ${RECENT_WINDOW} partidas` : `${lines.length} ${lines.length === 1 ? "partida" : "partidas"}`} ·{" "}
                        {modeLabel(mode)}
                      </h2>
                      <KpiRow cmp={cmp} trend={trend} />
                      {trend.length >= 2 ? (
                        <Panel title="Tendência" id="trend-title">
                          <div className="p-4 sm:p-5">
                            <TrendChart data={trend} />
                          </div>
                        </Panel>
                      ) : null}
                    </section>
                  ) : null}

                  {settings.showAgents ? (
                    <AgentsPanel agents={agents} seasons={seasons} season={season} modeName={modeLabel(mode)} />
                  ) : null}

                  {settings.showMaps ? (
                    <Panel title="Por mapa" id="maps-title">
                      <MapGrid maps={byMap(lines, mode)} className="lg:grid-cols-4" />
                    </Panel>
                  ) : null}

                  {settings.showWeapons ? <WeaponsPanel weapons={weaponMetrics} /> : null}

                  {settings.showMatches ? (
                    <>
                      <HistoryPanel
                        summary={historySummary(historyLines)}
                        summaryCaption={`${historyLines.length > HISTORY_SUMMARY_WINDOW ? `Últimas ${HISTORY_SUMMARY_WINDOW}` : historyLines.length === 1 ? "1 partida" : `${historyLines.length} partidas`} · ${modeLabel(mode)}`}
                        items={items}
                        total={historyLines.length}
                        now={now}
                        hrefFor={(item) => (canOpenMatches ? matchHref(item.matchId, isOwner ? null : profile.userId) : null)}
                        agents={filters.agents}
                        maps={filters.maps}
                        agent={agent}
                        map={map}
                        showRank={settings.showRank}
                        emptyDescription="Troque o agente ou o mapa para ver as outras partidas."
                      />
                      <p className="text-label font-normal text-fg-muted">
                        {canOpenMatches ? `Abra uma partida para ver o placar completo pelo lado de ${name}.` : `Cada partida mostra só a linha de ${name}. Entre no Retake para abrir o placar completo.`}
                      </p>
                    </>
                  ) : null}
                </>
              )}
            </FilteredContent>
          </FilterProvider>
        )
      ) : null}
    </div>
  );
}

function Panel({ title, id, children }: { title?: string; id?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={title ? id : undefined} className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      {title ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <h2 id={id} className="text-body-sm font-semibold text-fg">
            {title}
          </h2>
        </header>
      ) : null}
      {children}
    </section>
  );
}
