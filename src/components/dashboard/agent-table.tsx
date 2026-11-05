import { AgentAvatar } from "@/components/match/agent-avatar";
import { agentIconUrl } from "@/lib/assets";
import { formatNumber, formatPercent } from "@/lib/format";
import type { GroupStats } from "@/lib/stats/breakdown";

/** DESIGN.md › tabela: 13px tabular cells, numeric columns right-aligned. */
export function AgentTable({ agents }: { agents: readonly GroupStats[] }) {
  return (
    <table className="num w-full border-separate border-spacing-0 text-table">
      <caption className="sr-only">Desempenho por agente</caption>
      <thead>
        <tr className="text-label text-fg-secondary">
          <th scope="col" className="px-4 py-2 text-left font-medium">Agente</th>
          <th scope="col" className="px-3 py-2 text-right font-medium">Partidas</th>
          <th scope="col" className="px-3 py-2 text-right font-medium">Vitórias</th>
          <th scope="col" className="px-3 py-2 text-right font-medium">ACS</th>
          <th scope="col" className="hidden px-3 py-2 text-right font-medium sm:table-cell">K/D</th>
          <th scope="col" className="hidden py-2 pr-4 pl-3 text-right font-medium sm:table-cell">HS%</th>
        </tr>
      </thead>
      <tbody>
        {agents.map((a) => (
          <tr key={a.key} className="hover:bg-surface-2">
            <th scope="row" className="border-t border-line px-4 py-2 text-left font-normal">
              <span className="flex items-center gap-2.5">
                <AgentAvatar agent={a.name} src={agentIconUrl(a.id)} size={28} />
                <span className="truncate font-medium text-fg">{a.name}</span>
              </span>
            </th>
            <td className="border-t border-line px-3 py-2 text-right text-fg-secondary">{a.summary.matches}</td>
            <td className="border-t border-line px-3 py-2 text-right text-fg-secondary">
              {formatPercent(a.summary.winRate.rate, 0)}
            </td>
            <td className="border-t border-line px-3 py-2 text-right font-medium text-fg">
              {formatNumber(Math.round(a.summary.acs))}
            </td>
            <td className="hidden border-t border-line px-3 py-2 text-right text-fg-secondary sm:table-cell">
              {formatNumber(a.summary.kd, 2)}
            </td>
            <td className="hidden border-t border-line py-2 pr-4 pl-3 text-right text-fg-secondary sm:table-cell">
              {formatPercent(a.summary.hsRate, 0)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
