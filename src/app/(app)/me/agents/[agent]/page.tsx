import { Swords } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AgentMapTable } from "@/components/agents/agent-maps";
import { FilteredContent, FilterProvider } from "@/components/dashboard/dashboard-filters";
import { RecentMatches } from "@/components/dashboard/recent-matches";
import { GroupFilter } from "@/components/groups/group-filters";
import { AgentAvatar } from "@/components/match/agent-avatar";
import { BackLink } from "@/components/match/back-link";
import { AnimatedNumber } from "@/components/stats/animated-number";
import { KpiCard } from "@/components/stats/kpi-card";
import { TrendChart } from "@/components/stats/trend-chart";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { agentIconUrl } from "@/lib/assets";
import { requireViewer } from "@/lib/auth/session";
import { getPlayerLines } from "@/lib/dashboard/queries";
import { formatHours } from "@/lib/format";
import { modeAdjective, modeLabel } from "@/lib/modes";
import { ALL_SEASONS, filterBySeason, parseSeason, seasonOptions } from "@/lib/seasons";
import { getSeasonCatalog } from "@/lib/seasons-api";
import { ALL_MODES, DEFAULT_MODE, filterByMode } from "@/lib/stats/aggregate";
import { BEST_MAP_MIN_MATCHES, bestMap, linesForAgent, mapStats, performance } from "@/lib/stats/agents";
import { modeOptions, parseMode, trendSeries } from "@/lib/stats/breakdown";

export const metadata: Metadata = {
  title: "Agente",
  description: "Sua evolução com um agente: métricas ao longo do tempo, mapas e partidas.",
};

/** How many matches the evolution chart covers. */
const TREND_WINDOW = 50;

/** Question this screen answers: "como eu jogo com esse agente?" */
export default async function AgentPage({ params, searchParams }: PageProps<"/me/agents/[agent]">) {
  const [{ agent: rawSlug }, query] = await Promise.all([params, searchParams]);
  const slug = decodeURIComponent(rawSlug).toLowerCase();
  const { account } = await requireViewer(`/me/agents/${slug}`);
  const [allLines, catalog] = await Promise.all([getPlayerLines(account.puuid), getSeasonCatalog()]);

  // Every line with this agent, any mode: an agent never played is a 404.
  const agentLines = linesForAgent(allLines, slug);
  const first = agentLines[0];
  if (!first) notFound();
  const name = first.agentName ?? "Agente";

  const modes = modeOptions(agentLines);
  const mode = parseMode(query.mode, modes);
  const inMode = filterByMode(agentLines, mode);
  const seasons = seasonOptions(inMode, catalog);
  const season = parseSeason(query.season, seasons);
  const lines = filterBySeason(inMode, season);

  // Same mode and season with every agent: "am I better with this one?"
  const overall = performance(filterBySeason(filterByMode(allLines, mode), season));
  const stats = performance(lines);
  const comparable = overall.matches > stats.matches && stats.matches > 0;
  const delta = (a: number, b: number) => (comparable ? a - b : undefined);
  const note = stats.matches > 0 ? `${stats.matches} ${stats.matches === 1 ? "partida" : "partidas"}` : undefined;

  const maps = mapStats(lines);
  const best = bestMap(maps);
  const trend = trendSeries(lines, TREND_WINDOW);
  const mixed = mode === ALL_MODES;
  const seasonName = season === ALL_SEASONS ? "todas as temporadas" : seasons.find((s) => s.value === season)?.label;
  const now = new Date();

  return (
    <div className="content-enter flex flex-col gap-4 py-6 sm:py-8">
      <BackLink />
      <header className="flex items-center gap-4">
        <AgentAvatar agent={name} src={agentIconUrl(first.agentId)} size={48} />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="truncate text-heading text-fg">{name}</h1>
          <p className="num text-fg-secondary">
            {stats.matches} {stats.matches === 1 ? "partida" : "partidas"}
            {stats.timedMatches > 0 ? ` · ${formatHours(stats.playMs)} jogadas` : ""} · {modeLabel(mode)} · {seasonName}
          </p>
        </div>
      </header>

      <FilterProvider>
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <GroupFilter
            name="mode"
            label="Modo"
            options={modes.map((o) => ({ value: o.value, label: modeLabel(o.value) }))}
            value={mode}
            fallback={DEFAULT_MODE}
          />
          <GroupFilter
            name="season"
            label="Temporada"
            options={seasons.map((s) => ({ value: s.value, label: s.label }))}
            value={season}
            fallback={ALL_SEASONS}
          />
          {mixed ? <Badge variant="outline">Médias misturam todos os modos</Badge> : null}
        </div>

        <FilteredContent className="flex flex-col gap-4">
          {lines.length === 0 ? (
            <section className="rounded-card bg-surface-1 shadow-hairline">
              <EmptyState
                icon={Swords}
                title={`Nenhuma partida ${modeAdjective(mode)} de ${name}`.replace(/\s+/g, " ")}
                description="Você jogou com esse agente em outro modo. Veja todos os modos para encontrar essas partidas."
                action={
                  <Link href={`/me/agents/${slug}?mode=${ALL_MODES}`} className={buttonVariants()}>
                    Ver todos os modos
                  </Link>
                }
              />
            </section>
          ) : (
            <>
              <section aria-labelledby="agent-kpis" className="flex flex-col gap-3">
                <h2 id="agent-kpis" className="text-eyebrow text-fg-muted uppercase">
                  Com {name} · {comparable ? "variação vs. sua média com todos os agentes" : modeLabel(mode)}
                </h2>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <KpiCard
                    label="Vitórias"
                    hint={`${stats.wins} vitórias, ${stats.losses} derrotas, ${stats.draws} empates; empate não conta como vitória`}
                    value={<AnimatedNumber value={stats.winRate * 100} digits={1} suffix="%" />}
                    delta={delta(stats.winRate * 100, overall.winRate * 100)}
                    deltaSuffix="p.p."
                    note={`${stats.wins}V · ${stats.losses}D${stats.draws ? ` · ${stats.draws}E` : ""}`}
                  />
                  <KpiCard
                    label="K/D"
                    hint="abates por morte"
                    value={<AnimatedNumber value={stats.kd} digits={2} />}
                    delta={delta(stats.kd, overall.kd)}
                    deltaDigits={2}
                    deltaSuffix="vs. média"
                    note={note}
                  />
                  <KpiCard
                    label="ACS"
                    hint="pontuação de combate por round"
                    value={<AnimatedNumber value={Math.round(stats.acs)} />}
                    delta={delta(stats.acs, overall.acs)}
                    deltaDigits={0}
                    deltaSuffix="vs. média"
                    note={note}
                  />
                  <KpiCard
                    label="ADR"
                    hint="dano por round"
                    value={<AnimatedNumber value={Math.round(stats.adr)} />}
                    delta={delta(stats.adr, overall.adr)}
                    deltaDigits={0}
                    deltaSuffix="vs. média"
                    note={note}
                  />
                  <KpiCard
                    label="HS%"
                    hint="tiros na cabeça sobre todos os acertos"
                    value={<AnimatedNumber value={stats.hsRate * 100} digits={1} suffix="%" />}
                    delta={delta(stats.hsRate * 100, overall.hsRate * 100)}
                    deltaSuffix="p.p."
                    note={note}
                  />
                  <KpiCard
                    label="DDΔ"
                    hint="dano causado menos dano recebido, por round"
                    value={<AnimatedNumber value={Math.round(stats.ddDelta)} signed />}
                    delta={delta(stats.ddDelta, overall.ddDelta)}
                    deltaDigits={0}
                    deltaSuffix="vs. média"
                    note={note}
                  />
                </div>
              </section>

              <section aria-labelledby="agent-trend" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
                <header className="border-b border-line px-4 py-3">
                  <h2 id="agent-trend" className="text-body-sm font-semibold text-fg">
                    Evolução com {name}
                  </h2>
                </header>
                <div className="p-4 sm:p-5">
                  {trend.length >= 2 ? (
                    <TrendChart data={trend} />
                  ) : (
                    <p className="text-fg-secondary">A evolução aparece a partir da segunda partida com {name} nesse filtro.</p>
                  )}
                </div>
              </section>

              <section aria-labelledby="agent-maps" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
                <header className="flex flex-col gap-0.5 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <h2 id="agent-maps" className="text-body-sm font-semibold text-fg">
                    Por mapa
                  </h2>
                  <p className="text-label font-normal text-fg-muted">
                    {best
                      ? `Melhor mapa: ${best.mapName}, maior taxa de vitória com ${BEST_MAP_MIN_MATCHES}+ partidas`
                      : `Melhor mapa aparece com ${BEST_MAP_MIN_MATCHES}+ partidas num mapa`}
                  </p>
                </header>
                <AgentMapTable maps={maps} bestKey={best?.key ?? null} />
              </section>

              <section aria-labelledby="agent-matches" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
                <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                  <h2 id="agent-matches" className="text-body-sm font-semibold text-fg">
                    Partidas com {name}
                  </h2>
                  <span className="num text-label font-normal text-fg-muted">{lines.length}</span>
                </header>
                <RecentMatches lines={lines} now={now} />
              </section>
            </>
          )}
        </FilteredContent>
      </FilterProvider>
    </div>
  );
}
