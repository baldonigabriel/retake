import { Users } from "lucide-react";

import { AgentsBreakdown } from "@/components/agents/agents-table";
import { GroupFilter } from "@/components/groups/group-filters";
import { EmptyState } from "@/components/ui/states";
import { ALL_SEASONS, type SeasonOption } from "@/lib/seasons";
import type { AgentStats } from "@/lib/stats/agents";

/**
 * "Agentes" section: one row per agent, most played first, for the page's
 * mode (and period) plus its own season filter (?season=).
 */
export function AgentsPanel({
  agents,
  seasons,
  season,
  modeName,
  hrefFor,
}: {
  agents: readonly AgentStats[];
  seasons: readonly SeasonOption[];
  season: string;
  modeName: string;
  hrefFor?: (a: AgentStats) => string | null;
}) {
  const seasonName = seasons.find((s) => s.value === season)?.label;
  return (
    <section aria-labelledby="agents-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 id="agents-title" className="text-body-sm font-semibold text-fg">
            Agentes
          </h2>
          <p className="text-label font-normal text-fg-muted">
            {modeName} · {season === ALL_SEASONS ? "todas as temporadas" : seasonName}
          </p>
        </div>
        <GroupFilter
          name="season"
          label="Temporada"
          options={seasons.map((s) => ({ value: s.value, label: s.label }))}
          value={season}
          fallback={ALL_SEASONS}
        />
      </header>
      {agents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum agente nessa seleção"
          description="Troque a temporada, o modo ou o período para ver seus agentes."
        />
      ) : (
        <AgentsBreakdown agents={agents} hrefFor={hrefFor} />
      )}
    </section>
  );
}
