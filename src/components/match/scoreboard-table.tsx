import { AgentAvatar } from "@/components/match/agent-avatar";
import { ResultChip } from "@/components/stats/result-chip";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent } from "@/lib/format";
import { acs, adr, hsRate, kd, type MatchResult } from "@/lib/stats/metrics";
import { cn } from "@/lib/utils";

export type ScoreboardPlayer = {
  name: string;
  tag: string;
  agent: string;
  agentIcon?: string;
  score: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  headshots: number;
  bodyshots: number;
  legshots: number;
  isYou?: boolean;
  inGroup?: boolean;
};

export type ScoreboardTeam = {
  name: string;
  result: MatchResult;
  rounds: number;
  players: ScoreboardPlayer[];
};

const NUM_COLS = ["ACS", "K", "D", "A", "K/D", "HS%", "ADR"] as const;

/**
 * DESIGN.md › Placar da partida: one table per team, header with team name,
 * result and rounds; 13px tabular cells, numeric columns right-aligned, sticky
 * header; the user's row gets accent-tint + a 2px accent left border.
 * On narrow screens the table scrolls sideways with the player column pinned.
 */
export function ScoreboardTable({
  team,
  roundsPlayed,
}: {
  team: ScoreboardTeam;
  roundsPlayed: number;
}) {
  const sorted = [...team.players].sort((a, b) => b.score - a.score);
  const headingId = `team-${team.name.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-card bg-surface-1 shadow-hairline sm:overflow-visible">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <h3 id={headingId} className="text-body-sm font-semibold text-fg">
          {team.name}
        </h3>
        <ResultChip result={team.result} long />
        <span className="stat ml-auto text-[24px] leading-none font-semibold text-fg">
          {team.rounds}
          <span className="sr-only"> rounds</span>
        </span>
      </header>
      <div
        className="overflow-x-auto sm:overflow-visible"
        tabIndex={0}
        role="region"
        aria-label={`Placar do ${team.name}, role para o lado para ver todas as colunas`}
      >
        <table className="num w-full min-w-[640px] border-separate border-spacing-0 text-table [&_tbody_tr:last-child>*:first-child]:rounded-bl-card [&_tbody_tr:last-child>*:last-child]:rounded-br-card">
          <thead>
            <tr>
              <th
                scope="col"
                className={cn(
                  "sticky left-0 z-20 bg-surface-1 px-4 py-2 text-left text-label text-fg-secondary sm:z-10",
                  "sm:top-14",
                )}
              >
                Jogador
              </th>
              {NUM_COLS.map((col) => (
                <th
                  key={col}
                  scope="col"
                  className={cn(
                    "z-10 bg-surface-1 px-3 py-2 text-right text-label text-fg-secondary last:pr-4 sm:sticky",
                    "sm:top-14",
                  )}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((p) => {
              const values = [
                formatNumber(acs(p.score, roundsPlayed)),
                p.kills,
                p.deaths,
                p.assists,
                formatNumber(kd(p.kills, p.deaths), 2),
                formatPercent(hsRate(p.headshots, p.bodyshots, p.legshots), 0),
                formatNumber(adr(p.damage, roundsPlayed)),
              ];
              const rowBg = p.isYou ? "bg-accent-tint" : "bg-surface-1 group-hover/row:bg-surface-2";
              return (
                <tr key={`${p.name}#${p.tag}`} className={cn("group/row", p.isYou && "on-tint")} aria-current={p.isYou ? "true" : undefined}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 border-t border-line px-4 py-2 text-left font-normal transition-colors duration-150",
                      rowBg,
                      p.isYou && "shadow-[inset_2px_0_0_var(--color-primary)]",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <AgentAvatar agent={p.agent} src={p.agentIcon} size={28} />
                      <span className="flex min-w-0 items-baseline gap-1">
                        <span className="max-w-[9rem] truncate font-medium text-fg">{p.name}</span>
                        <span className="font-mono text-label text-fg-muted">#{p.tag}</span>
                      </span>
                      {p.isYou ? <span className="sr-only">(você)</span> : null}
                      {p.inGroup ? <Badge variant="outline">grupo</Badge> : null}
                    </span>
                  </th>
                  {values.map((v, i) => (
                    <td
                      key={NUM_COLS[i]}
                      className={cn(
                        "border-t border-line px-3 py-2 text-right text-fg-secondary transition-colors duration-150 last:pr-4",
                        i === 0 && "font-medium text-fg",
                        rowBg,
                      )}
                    >
                      {v}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
