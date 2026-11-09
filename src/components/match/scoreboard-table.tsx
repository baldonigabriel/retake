import Link from "next/link";

import { RrDelta, TierIcon } from "@/components/history/history-row";
import { AgentAvatar } from "@/components/match/agent-avatar";
import { ResultChip } from "@/components/stats/result-chip";
import { Badge } from "@/components/ui/badge";
import { formatNumber, formatPercent } from "@/lib/format";
import { tierLabel } from "@/lib/ranks";
import { acs, adr, hsRate, kd, type MatchResult } from "@/lib/stats/metrics";
import { cn } from "@/lib/utils";

export type ScoreboardPlayer = {
  /** puuid; falls back to name#tag in the sample data */
  id?: string;
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
  /**
   * Profile link for the name (SPEC §6.5): member profile for group mates,
   * /u/... for public profiles; absent for everyone else.
   */
  href?: string | null;
  /** Rank in this match; undefined hides the rank column (sample data) */
  tier?: number | null;
  /**
   * RR won or lost: only for Retake users. undefined = not a user (nothing
   * shown), null = a user whose RR the API didn't report ("—").
   */
  rr?: number | null;
  roundStats?: { firstBloods: number; firstDeaths: number; kast: number | null; multiKills: string };
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
  headingLevel = "h3",
  showRr = false,
  highlightLabel = "você",
}: {
  team: ScoreboardTeam;
  roundsPlayed: number;
  /** h2 when the table is a top-level section of the page */
  headingLevel?: "h2" | "h3";
  /** Competitive matches: RR column for the players who use Retake */
  showRr?: boolean;
  /** What screen readers hear on the highlighted row: "você", or the player the page is seen from. */
  highlightLabel?: string;
}) {
  const showRank = team.players.some((p) => p.tier !== undefined);
  const showRounds = team.players.some((p) => p.roundStats !== undefined);
  const Heading = headingLevel;
  const sorted = [...team.players].sort((a, b) => b.score - a.score);
  const headingId = `team-${team.name.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <section aria-labelledby={headingId} className="overflow-hidden rounded-card bg-surface-1 shadow-hairline sm:overflow-visible">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Heading id={headingId} className="text-body-sm font-semibold text-fg">
          {team.name}
        </Heading>
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
        <table className={cn("num w-full table-fixed border-separate border-spacing-0 text-table [&_tbody_tr:last-child>*:first-child]:rounded-bl-card [&_tbody_tr:last-child>*:last-child]:rounded-br-card", showRounds ? "min-w-[980px]" : "min-w-[640px]", showRank && showRr ? "sm:min-w-[1120px]" : showRank && showRounds ? "sm:min-w-[1040px]" : showRank ? "sm:min-w-[740px]" : "")}>
          <thead>
            <tr>
              <th
                scope="col"
                className={cn(
                  "sticky left-0 z-20 w-[220px] bg-surface-1 px-4 py-2 text-left text-label text-fg-secondary sm:z-10 sm:w-[30%]",
                  "sm:top-14",
                )}
              >
                Jogador
              </th>
              {showRank ? (
                <th scope="col" className="z-10 hidden w-[15%] bg-surface-1 px-3 py-2 text-left text-label text-fg-secondary sm:sticky sm:top-14 sm:table-cell">
                  Rank
                </th>
              ) : null}
              {showRr ? (
                <th
                  scope="col"
                  className="z-10 w-[88px] bg-surface-1 px-3 py-2 text-right text-label text-fg-secondary sm:sticky sm:top-14"
                  title="RR ganho ou perdido; só aparece para quem usa o Retake"
                >
                  RR
                </th>
              ) : null}
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
              {showRounds ? ["FB", "FD", "KAST", "Multi"].map((col) => (
                <th key={col} scope="col" className="z-10 bg-surface-1 px-3 py-2 text-right text-label text-fg-secondary sm:sticky sm:top-14">{col}</th>
              )) : null}
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
                <tr key={p.id ?? `${p.name}#${p.tag}`} className={cn("group/row", p.isYou && "on-tint")} aria-current={p.isYou ? "true" : undefined}>
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 border-t border-line px-4 py-2 text-left font-normal",
                      rowBg,
                      p.isYou && "shadow-[inset_2px_0_0_var(--color-primary)]",
                    )}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className="relative shrink-0">
                        <AgentAvatar agent={p.agent} src={p.agentIcon} size={28} />
                        {/* 390px: the rank rides on the avatar; the Rank column is hidden. */}
                        {showRank ? (
                          <span className="absolute -right-1.5 -bottom-1 sm:hidden">
                            <TierIcon tier={p.tier ?? null} size={16} />
                          </span>
                        ) : null}
                      </span>
                      <span className="flex min-w-0 items-baseline gap-1">
                        {p.href ? (
                          <Link
                            href={p.href}
                            className="max-w-[9rem] truncate font-medium text-fg underline decoration-line-strong underline-offset-4 hover:decoration-fg"
                          >
                            {p.name}
                          </Link>
                        ) : (
                          <span className="max-w-[9rem] truncate font-medium text-fg">{p.name}</span>
                        )}
                        <span className="font-mono text-label text-fg-muted">#{p.tag}</span>
                      </span>
                      {p.isYou ? <span className="sr-only">({highlightLabel})</span> : null}
                      {p.inGroup ? <Badge variant="outline">grupo</Badge> : null}
                    </span>
                  </th>
                  {showRank ? (
                    <td className={cn("hidden border-t border-line px-3 py-2 text-left whitespace-nowrap text-fg-secondary sm:table-cell", rowBg)}>
                      <span className="flex items-center gap-2">
                        <TierIcon tier={p.tier ?? null} size={20} />
                        <span aria-hidden="true">{tierLabel(p.tier)}</span>
                      </span>
                    </td>
                  ) : null}
                  {showRr ? (
                    <td className={cn("border-t border-line px-3 py-2 text-right whitespace-nowrap", rowBg)}>
                      {p.rr === undefined ? null : <RrDelta value={p.rr} />}
                    </td>
                  ) : null}
                  {values.map((v, i) => (
                    <td
                      key={NUM_COLS[i]}
                      className={cn(
                        "border-t border-line px-3 py-2 text-right text-fg-secondary last:pr-4",
                        i === 0 && "font-medium text-fg",
                        rowBg,
                      )}
                    >
                      {v}
                    </td>
                  ))}
                  {showRounds ? (
                    <>
                      <td className={cn("border-t border-line px-3 py-2 text-right text-fg-secondary", rowBg)}>{p.roundStats?.firstBloods ?? "—"}</td>
                      <td className={cn("border-t border-line px-3 py-2 text-right text-fg-secondary", rowBg)}>{p.roundStats?.firstDeaths ?? "—"}</td>
                      <td className={cn("border-t border-line px-3 py-2 text-right text-fg-secondary", rowBg)}>{p.roundStats?.kast == null ? "—" : formatPercent(p.roundStats.kast, 0)}</td>
                      <td className={cn("border-t border-line px-3 py-2 text-right text-fg-secondary", rowBg)}>{p.roundStats?.multiKills || "—"}</td>
                    </>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
