import { Clock, Lightbulb, Map as MapIcon, Moon, Sun, Sunrise } from "lucide-react";

import { AgentAvatar } from "@/components/match/agent-avatar";
import { agentIconUrl } from "@/lib/assets";
import { modeLabel } from "@/lib/modes";
import { INSIGHT_MIN_SEGMENT, type Insight, type InsightsResult } from "@/lib/stats/insights";
import { cn } from "@/lib/utils";

const TIME_ICON: Record<string, typeof Clock> = {
  "à noite": Moon,
  "de madrugada": Moon,
  "de manhã": Sunrise,
  "à tarde": Sun,
};

/**
 * Agent icon, or a line icon for maps and times of day. (Map art is a wide
 * strip that turns into a blur at 36px, so maps get an icon too.)
 */
function Subject({ insight }: { insight: Insight }) {
  if (insight.kind.startsWith("agent")) {
    return <AgentAvatar agent={insight.subject} src={agentIconUrl(insight.subjectId)} size={36} />;
  }
  const Icon = insight.kind.startsWith("map") ? MapIcon : (TIME_ICON[insight.subject] ?? Clock);
  return (
    <span aria-hidden="true" className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-2 shadow-hairline">
      <Icon className="size-4 text-fg-secondary" strokeWidth={1.75} />
    </span>
  );
}

/**
 * "Tendências": automatic insights over the filtered selection. Server
 * component, no motion: it re-renders on every filter change.
 */
export function InsightsPanel({ result, mode }: { result: InsightsResult; mode: string }) {
  return (
    <section aria-labelledby="insights-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="insights-title" className="text-body-sm font-semibold text-fg">
          Tendências
        </h2>
        <span className="num text-label font-normal text-fg-muted">
          {modeLabel(mode)}
          {result.status === "too-few" ? "" : ` · ${result.matches} partidas`}
        </span>
      </header>

      {result.status === "ok" ? (
        <>
          <ul className="grid divide-y divide-line lg:grid-cols-2 lg:divide-y-0">
            {result.insights.map((insight, i) => (
              <li
                key={insight.id}
                className={cn(
                  "flex min-h-16 items-start gap-3 px-4 py-3",
                  // Two columns on desktop: hairlines between rows and columns, none on the outer edge.
                  "lg:border-line lg:[&:nth-child(n+3)]:border-t lg:[&:nth-child(even)]:border-l",
                  i === result.insights.length - 1 && i % 2 === 0 && "lg:col-span-2",
                )}
              >
                <Subject insight={insight} />
                <div className="flex min-w-0 flex-col gap-1">
                  <p className="text-fg">{insight.sentence}</p>
                  <p className="num flex flex-wrap items-center gap-x-1.5 text-label font-normal text-fg-muted">
                    <span className={cn("inline-flex items-center gap-1", insight.tone === "up" ? "text-win" : "text-loss")}>
                      <span aria-hidden="true" className="text-[9px] leading-none">
                        {insight.tone === "up" ? "▲" : "▼"}
                      </span>
                      {insight.tone === "up" ? "acima do seu normal" : "abaixo do seu normal"}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{insight.sample}</span>
                  </p>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-3 text-label font-normal text-fg-muted">
            Tendências das suas partidas, não regras. Cada uma precisa de pelo menos {INSIGHT_MIN_SEGMENT} partidas no recorte
            e muda conforme você joga.
          </p>
        </>
      ) : (
        <div className="flex items-start gap-3 px-4 py-4">
          <Lightbulb aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-muted" strokeWidth={1.5} />
          {result.status === "too-few" ? (
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <p className="text-fg">
                Faltam {result.need - result.have} {result.need - result.have === 1 ? "partida" : "partidas"} para apontarmos
                tendências com segurança.
              </p>
              <p className="text-fg-secondary">
                Com poucas partidas, um dia bom ou ruim parece padrão. A partir de {result.need}, comparamos seus mapas, agentes
                e horários.
              </p>
              <div
                role="progressbar"
                aria-label="Partidas para liberar as tendências"
                aria-valuemin={0}
                aria-valuemax={result.need}
                aria-valuenow={result.have}
                className="mt-1 flex items-center gap-3"
              >
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className="block h-full rounded-full bg-fg-secondary"
                    style={{ width: `${Math.min(100, (result.have / result.need) * 100)}%` }}
                  />
                </span>
                <span className="num shrink-0 text-label font-normal text-fg-muted">
                  {result.have} de {result.need}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-fg-secondary">
              Nenhuma tendência clara nas suas {result.matches} partidas: seu desempenho está parecido em mapas, agentes e
              horários. Bom sinal de consistência.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
