import { Link2Off, Swords } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { AgentsPanel } from "@/components/agents/agents-panel";
import { FilteredContent, FilterProvider } from "@/components/dashboard/dashboard-filters";
import { GroupFilter } from "@/components/groups/group-filters";
import { HistoryPanel } from "@/components/history/history-panel";
import { Avatar } from "@/components/layout/account-menu";
import { BackLink } from "@/components/match/back-link";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { requireViewer } from "@/lib/auth/session";
import { withExtras } from "@/lib/dashboard/history";
import { getPlayerLines } from "@/lib/dashboard/queries";
import { getGroupMember, getMembership } from "@/lib/groups/queries";
import { getMatchesPlayedBy } from "@/lib/match/queries";
import { modeLabel } from "@/lib/modes";
import { filterBySeason, parseSeason, seasonOptions } from "@/lib/seasons";
import { getSeasonCatalog } from "@/lib/seasons-api";
import { ALL_MODES, DEFAULT_MODE, filterByMode } from "@/lib/stats/aggregate";
import { agentStats } from "@/lib/stats/agents";
import { modeOptions, parseMode } from "@/lib/stats/breakdown";
import {
  HISTORY_SUMMARY_WINDOW,
  filterHistory,
  historyOptions,
  historySummary,
  parseHistoryFilter,
  parseShow,
} from "@/lib/stats/history";

export const metadata: Metadata = {
  title: "Perfil no grupo",
  description: "Agentes e partidas de um membro do grupo.",
  robots: { index: false, follow: false },
};

/**
 * A group member's agents and matches. Access (CLAUDE.md › Privacidade):
 * the viewer must be in the group (getMembership) AND the profile's user
 * must be in that same group (getGroupMember); anything else is the same
 * 404 as a group that doesn't exist. Only that member's own puuid is read.
 */
export default async function MemberProfilePage({ params, searchParams }: PageProps<"/groups/[slug]/members/[userId]">) {
  const [{ slug, userId: rawUserId }, query] = await Promise.all([params, searchParams]);
  const userId = decodeURIComponent(rawUserId);
  const { user, account } = await requireViewer(`/groups/${slug}/members/${rawUserId}`);
  const membership = await getMembership(slug, user.id);
  if (!membership) notFound();
  const { group } = membership;
  if (userId === user.id) redirect("/me");
  const member = await getGroupMember(group.id, userId);
  if (!member) notFound();

  const header = (
    <>
      <BackLink href={`/groups/${group.slug}`} label={group.name} />
      <header className="flex items-center gap-4">
        <Avatar name={member.name} image={member.image} className="size-12 text-body-sm" />
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-2 text-heading text-fg">
            <span className="truncate">{member.name}</span>
            {member.tag ? <span className="font-mono text-body-sm font-normal text-fg-muted">#{member.tag}</span> : null}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-fg-secondary">
            Membro de {group.name}
            {member.role === "owner" ? <Badge>dono</Badge> : null}
          </p>
        </div>
      </header>
    </>
  );

  if (!member.puuid) {
    return (
      <div className="content-enter flex flex-col gap-4 py-6 sm:py-8">
        {header}
        <section className="rounded-card bg-surface-1 shadow-hairline">
          <EmptyState
            icon={Link2Off}
            title={`${member.name} ainda não vinculou o Riot ID`}
            description="As estatísticas aparecem aqui depois que essa pessoa vincular a conta do Valorant no Retake."
          />
        </section>
      </div>
    );
  }

  const [allLines, catalog] = await Promise.all([getPlayerLines(member.puuid), getSeasonCatalog()]);
  const modes = modeOptions(allLines);
  const mode = parseMode(query.mode, modes);
  const lines = filterByMode(allLines, mode);
  const seasons = seasonOptions(lines, catalog);
  const season = parseSeason(query.season, seasons);
  const agents = agentStats(filterBySeason(lines, season));

  const filters = historyOptions(lines);
  const agent = parseHistoryFilter(query.agent, filters.agents);
  const map = parseHistoryFilter(query.map, filters.maps);
  const historyLines = filterHistory(lines, { agent, map });
  const items = await withExtras(member.puuid, historyLines.slice(0, parseShow(query.show)));
  // The match page only opens for its players: link the matches the viewer was in.
  const played = await getMatchesPlayedBy(
    account.puuid,
    items.map((i) => i.matchId),
  );
  const now = new Date();

  return (
    <div className="content-enter flex flex-col gap-4 py-6 sm:py-8">
      {header}
      {allLines.length === 0 ? (
        <section className="rounded-card bg-surface-1 shadow-hairline">
          <EmptyState
            icon={Swords}
            title={`Ainda não temos partidas de ${member.name}`}
            description="As partidas aparecem aqui até 15 minutos depois de cada jogo."
          />
        </section>
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
              <section className="rounded-card bg-surface-1 shadow-hairline">
                <EmptyState
                  icon={Swords}
                  title={`Nenhuma partida de ${member.name} nesse modo`}
                  description="Troque o modo acima para ver as outras partidas."
                />
              </section>
            ) : (
              <>
                <AgentsPanel agents={agents} seasons={seasons} season={season} modeName={modeLabel(mode)} />
                <HistoryPanel
                  summary={historySummary(historyLines)}
                  summaryCaption={`${historyLines.length > HISTORY_SUMMARY_WINDOW ? `Últimas ${HISTORY_SUMMARY_WINDOW}` : historyLines.length === 1 ? "1 partida" : `${historyLines.length} partidas`} · ${modeLabel(mode)}`}
                  items={items}
                  total={historyLines.length}
                  now={now}
                  hrefFor={(item) => (played.has(item.matchId) ? `/match/${item.matchId}` : null)}
                  agents={filters.agents}
                  maps={filters.maps}
                  agent={agent}
                  map={map}
                />
                <p className="text-label font-normal text-fg-muted">
                  Só as partidas em que você também jogou abrem o placar completo.
                </p>
              </>
            )}
          </FilteredContent>
        </FilterProvider>
      )}
    </div>
  );
}
