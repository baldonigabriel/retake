import { ChevronDown, ChevronRight } from "lucide-react";
import Link from "next/link";

import { AgentAvatar } from "@/components/match/agent-avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { agentIconUrl } from "@/lib/assets";
import { formatHours, formatNumber, formatPercent, formatSigned } from "@/lib/format";
import { BEST_MAP_MIN_MATCHES, columnBests, type AgentColumn, type AgentStats } from "@/lib/stats/agents";
import { cn } from "@/lib/utils";

type Bests = Record<AgentColumn, Set<string>>;

const COLUMNS: readonly { key: AgentColumn; label: string; title: string; format: (a: AgentStats) => string }[] = [
  { key: "winRate", label: "Vitórias", title: "vitórias sobre partidas; empate não conta como vitória", format: (a) => formatPercent(a.winRate, 1) },
  { key: "kd", label: "K/D", title: "abates por morte", format: (a) => formatNumber(a.kd, 2) },
  { key: "adr", label: "ADR", title: "dano por round", format: (a) => formatNumber(Math.round(a.adr)) },
  { key: "acs", label: "ACS", title: "pontuação de combate por round", format: (a) => formatNumber(Math.round(a.acs)) },
  { key: "hsRate", label: "HS%", title: "tiros na cabeça sobre todos os acertos", format: (a) => formatPercent(a.hsRate, 1) },
  { key: "ddDelta", label: "DDΔ", title: "dano causado menos dano recebido, por round", format: (a) => formatSigned(a.ddDelta, 0) },
];

const record = (a: AgentStats) => `${a.wins}–${a.losses}${a.draws ? `–${a.draws}` : ""}`;
const recordLabel = (a: AgentStats) =>
  `${a.wins} ${a.wins === 1 ? "vitória" : "vitórias"}, ${a.losses} ${a.losses === 1 ? "derrota" : "derrotas"}${a.draws ? `, ${a.draws} ${a.draws === 1 ? "empate" : "empates"}` : ""}`;
const hours = (a: AgentStats) => (a.timedMatches > 0 ? formatHours(a.playMs) : "—");

/**
 * The best value of a column: brighter, heavier and underlined in the brand
 * red (a shape, not only a colour), and announced as "melhor" to screen readers.
 */
function Value({ best, children }: { best: boolean; children: React.ReactNode }) {
  return best ? (
    <span className="font-semibold text-fg underline decoration-primary decoration-2 underline-offset-[5px]">
      {children}
      <span className="sr-only"> (melhor)</span>
    </span>
  ) : (
    <>{children}</>
  );
}

function BestMap({ agent }: { agent: AgentStats }) {
  const map = agent.bestMap;
  if (!map) {
    return (
      <span className="text-fg-muted" title={`Nenhum mapa com ${BEST_MAP_MIN_MATCHES} partidas ou mais`}>
        —<span className="sr-only">: nenhum mapa com {BEST_MAP_MIN_MATCHES} partidas ou mais</span>
      </span>
    );
  }
  return (
    <span className="whitespace-nowrap">
      <span className="text-fg">{map.mapName}</span>{" "}
      <span className="text-fg-muted">{formatPercent(map.winRate, 0)}</span>
      <span className="sr-only"> de vitórias em {map.matches} partidas</span>
    </span>
  );
}

function AgentName({ agent, href }: { agent: AgentStats; href: string | null }) {
  const content = (
    <span className="flex min-w-0 items-center gap-2.5">
      <AgentAvatar agent={agent.agentName} src={agentIconUrl(agent.agentId)} size={28} />
      <span className="truncate font-medium text-fg">{agent.agentName}</span>
    </span>
  );
  if (!href) return content;
  return (
    // The link covers the whole row (after:inset-0 on the positioned <tr>).
    <Link href={href} className="rounded-chip after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-4">
      {content}
    </Link>
  );
}

/**
 * Agents table (DESIGN.md › tabela): 13px tabular cells, numbers right-aligned,
 * scrolling sideways on mid widths. The agent link covers the row, which
 * highlights without transition (DESIGN.md › Interação). Below `md` the same
 * data is a card list (AgentCards).
 */
export function AgentsTable({
  agents,
  hrefFor,
  bests,
}: {
  agents: readonly AgentStats[];
  hrefFor: (a: AgentStats) => string | null;
  bests: Bests;
}) {
  return (
    <div className="hidden overflow-x-auto md:block">
      <table className="num w-full min-w-[920px] border-separate border-spacing-0 text-table">
        <caption className="sr-only">Desempenho por agente, ordenado por partidas</caption>
        <thead>
          <tr className="text-label text-fg-secondary">
            <th scope="col" className="px-4 py-2 text-left font-medium">Agente</th>
            <th scope="col" className="px-3 py-2 text-right font-medium">Partidas</th>
            <th scope="col" className="px-3 py-2 text-right font-medium" title="soma da duração das partidas">Horas</th>
            <th scope="col" className="px-3 py-2 text-right font-medium" title="vitórias–derrotas(–empates)">V–D</th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="px-3 py-2 text-right font-medium" title={c.title}>
                {c.label}
              </th>
            ))}
            <th scope="col" className="py-2 pr-4 pl-3 text-left font-medium" title={`maior taxa de vitória com ${BEST_MAP_MIN_MATCHES}+ partidas`}>
              Melhor mapa
            </th>
          </tr>
        </thead>
        <tbody>
          {agents.map((a) => {
            const href = hrefFor(a);
            const cell = "border-t border-line bg-surface-1 px-3 py-2 text-right text-fg-secondary group-hover/row:bg-surface-2";
            return (
              <tr key={a.key} className={cn("group/row", href && "relative")}>
                <th scope="row" className={cn(cell, "px-4 text-left font-normal")}>
                  <AgentName agent={a} href={href} />
                </th>
                <td className={cn(cell, "text-fg")}>{a.matches}</td>
                <td className={cell}>{hours(a)}</td>
                <td className={cell}>
                  <span aria-hidden="true">{record(a)}</span>
                  <span className="sr-only">{recordLabel(a)}</span>
                </td>
                {COLUMNS.map((c) => (
                  <td key={c.key} className={cell}>
                    <Value best={bests[c.key].has(a.key)}>{c.format(a)}</Value>
                  </td>
                ))}
                <td className={cn(cell, "pr-4 text-left")}>
                  <BestMap agent={a} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const MAIN: readonly AgentColumn[] = ["winRate", "kd", "acs"];
const MORE: readonly AgentColumn[] = ["adr", "hsRate", "ddDelta"];

/**
 * 390px: one card per agent with the main numbers; the rest opens in place
 * (native <details>, keyboard and screen-reader friendly; the content fades
 * in, nothing animates height).
 */
export function AgentCards({
  agents,
  hrefFor,
  bests,
}: {
  agents: readonly AgentStats[];
  hrefFor: (a: AgentStats) => string | null;
  bests: Bests;
}) {
  const col = (key: AgentColumn) => COLUMNS.find((c) => c.key === key)!;
  return (
    <ul className="divide-y divide-line md:hidden" aria-label="Desempenho por agente, ordenado por partidas">
      {agents.map((a) => {
        const href = hrefFor(a);
        const head = (
          <>
            <AgentAvatar agent={a.agentName} src={agentIconUrl(a.agentId)} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium text-fg">{a.agentName}</span>
              <span className="num text-label font-normal text-fg-muted">
                {a.matches} {a.matches === 1 ? "partida" : "partidas"} · {hours(a)} ·{" "}
                <span aria-hidden="true">{record(a)}</span>
                <span className="sr-only">{recordLabel(a)}</span>
              </span>
            </span>
            {href ? <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-fg-muted" /> : null}
          </>
        );
        return (
          <li key={a.key} className="flex flex-col">
            {href ? (
              <Link href={href} className="hover-layer press relative flex min-h-14 items-center gap-3 px-4 py-2 [--press-scale:0.99] focus-visible:outline-offset-[-2px]">
                {head}
              </Link>
            ) : (
              <div className="flex min-h-14 items-center gap-3 px-4 py-2">{head}</div>
            )}
            <dl className="grid grid-cols-3 gap-2 px-4 pb-2">
              {MAIN.map((key) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <dt className="text-eyebrow text-fg-muted uppercase">{col(key).label}</dt>
                  <dd className="stat text-[22px] leading-none font-semibold text-fg-secondary">
                    <Value best={bests[key].has(a.key)}>{col(key).format(a)}</Value>
                  </dd>
                </div>
              ))}
            </dl>
            <details className="group/more">
              <summary className="hover-layer relative flex min-h-11 cursor-pointer list-none items-center gap-1.5 px-4 text-label text-fg-secondary focus-visible:outline-offset-[-2px] [&::-webkit-details-marker]:hidden">
                <ChevronDown aria-hidden="true" className="size-4 transition-transform duration-150 ease-(--ease-out) group-open/more:rotate-180 motion-reduce:transition-none" />
                <span className="group-open/more:hidden">Mais números</span>
                <span className="hidden group-open/more:inline">Menos números</span>
                <span className="sr-only"> de {a.agentName}</span>
              </summary>
              <dl className="grid grid-cols-3 gap-x-2 gap-y-3 px-4 pt-1 pb-4 group-open/more:animate-[fade_150ms_var(--ease-out)]">
                {MORE.map((key) => (
                  <div key={key} className="flex flex-col gap-0.5">
                    <dt className="text-eyebrow text-fg-muted uppercase">{col(key).label}</dt>
                    <dd className="stat text-[22px] leading-none font-semibold text-fg-secondary">
                      <Value best={bests[key].has(a.key)}>{col(key).format(a)}</Value>
                    </dd>
                  </div>
                ))}
                <div className="col-span-3 flex flex-col gap-0.5">
                  <dt className="text-eyebrow text-fg-muted uppercase">Melhor mapa</dt>
                  <dd className="text-body-sm">
                    <BestMap agent={a} />
                  </dd>
                </div>
              </dl>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

/** Both layouts plus the legend for the highlight. */
export function AgentsBreakdown({
  agents,
  hrefFor = () => null,
}: {
  agents: readonly AgentStats[];
  hrefFor?: (a: AgentStats) => string | null;
}) {
  const bests = columnBests(agents);
  const highlighted = Object.values(bests).some((s) => s.size > 0);
  return (
    <>
      <AgentsTable agents={agents} hrefFor={hrefFor} bests={bests} />
      <AgentCards agents={agents} hrefFor={hrefFor} bests={bests} />
      <p className="border-t border-line px-4 py-3 text-label font-normal text-fg-muted">
        {highlighted ? (
          <>
            <span className="font-semibold text-fg-secondary underline decoration-primary decoration-2 underline-offset-[5px]">Sublinhado</span>{" "}
            = melhor da coluna entre agentes com {BEST_MAP_MIN_MATCHES}+ partidas. Melhor mapa: maior taxa de vitória com{" "}
            {BEST_MAP_MIN_MATCHES}+ partidas.
          </>
        ) : (
          <>Destaques e melhor mapa aparecem a partir de {BEST_MAP_MIN_MATCHES} partidas com o agente.</>
        )}{" "}
        DDΔ = dano causado − recebido, por round.
      </p>
    </>
  );
}

export function AgentsBreakdownSkeleton() {
  return (
    <div aria-hidden="true">
      {Array.from({ length: 4 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-line px-4 py-2.5 first:border-t-0">
          <Skeleton className="size-7 rounded-full md:size-7" />
          <Skeleton className="h-3.5 w-24" />
          <div className="ml-auto hidden gap-6 md:flex">
            {Array.from({ length: 8 }, (_, j) => (
              <Skeleton key={j} className="h-3.5 w-10" />
            ))}
          </div>
          <Skeleton className="ml-auto h-3.5 w-16 md:hidden" />
        </div>
      ))}
    </div>
  );
}
