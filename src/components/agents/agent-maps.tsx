import { mapThumbUrl } from "@/lib/assets";
import { formatNumber, formatPercent, formatSigned } from "@/lib/format";
import type { MapStats } from "@/lib/stats/agents";
import { cn } from "@/lib/utils";

/**
 * How the agent does on each map, most played first. The best map (the
 * agent's highest win rate with enough matches) carries a "melhor mapa" badge
 * in words, not a colour. Narrow screens keep map, matches, win rate and ACS.
 */
export function AgentMapTable({ maps, bestKey }: { maps: readonly MapStats[]; bestKey: string | null }) {
  return (
    <table className="num w-full border-separate border-spacing-0 text-table">
      <caption className="sr-only">Desempenho com o agente por mapa</caption>
      <thead>
        <tr className="text-label text-fg-secondary">
          <th scope="col" className="px-4 py-2 text-left font-medium">Mapa</th>
          <th scope="col" className="px-3 py-2 text-right font-medium">
            <span className="sm:hidden" aria-hidden="true">Part.</span>
            <span className="sr-only sm:not-sr-only">Partidas</span>
          </th>
          <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">V–D</th>
          <th scope="col" className="px-3 py-2 text-right font-medium">Vitórias</th>
          <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">K/D</th>
          <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell">ADR</th>
          <th scope="col" className="hidden px-3 py-2 text-right font-medium md:table-cell" title="dano causado menos recebido, por round">DDΔ</th>
          <th scope="col" className="py-2 pr-4 pl-3 text-right font-medium">ACS</th>
        </tr>
      </thead>
      <tbody>
        {maps.map((m) => {
          const thumb = mapThumbUrl(m.mapId);
          const best = m.key === bestKey;
          const cell = "border-t border-line px-3 py-2 text-right text-fg-secondary";
          return (
            <tr key={m.key}>
              <th scope="row" className="border-t border-line px-4 py-2 text-left font-normal">
                <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span
                    aria-hidden="true"
                    className="hidden h-7 w-12 shrink-0 rounded-chip sm:block bg-surface-3 bg-cover bg-center shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
                    style={thumb ? { backgroundImage: `url(${thumb})` } : undefined}
                  />
                  <span className="truncate font-medium text-fg">{m.mapName}</span>
                  {best ? (
                    <span className="shrink-0 rounded-chip bg-accent-tint px-1.5 py-0.5 text-label text-fg shadow-[inset_0_0_0_1px_var(--color-accent-line)]">
                      melhor<span className="hidden sm:inline"> mapa</span>
                    </span>
                  ) : null}
                </span>
              </th>
              <td className={cn(cell, "text-fg")}>{m.matches}</td>
              <td className={cn(cell, "hidden sm:table-cell")}>
                {m.wins}–{m.losses}
                {m.draws ? `–${m.draws}` : ""}
              </td>
              <td className={cn(cell, best && "font-semibold text-fg")}>{formatPercent(m.winRate, 0)}</td>
              <td className={cn(cell, "hidden sm:table-cell")}>{formatNumber(m.kd, 2)}</td>
              <td className={cn(cell, "hidden md:table-cell")}>{formatNumber(Math.round(m.adr))}</td>
              <td className={cn(cell, "hidden md:table-cell")}>{formatSigned(m.ddDelta, 0)}</td>
              <td className={cn(cell, "pr-4 font-medium text-fg")}>{formatNumber(Math.round(m.acs))}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
