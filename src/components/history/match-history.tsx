import { StaggerList } from "@/components/dashboard/stagger-list";
import { HistoryRow, RrDelta, type HistoryItem } from "@/components/history/history-row";
import { groupByDay } from "@/lib/stats/history";

/**
 * Matches grouped by São Paulo day, newest first. Each day says its balance
 * (wins, losses, draws and the RR total, "—" if any competitive match that
 * day has no RR). Rows enter staggered on the first load only.
 */
export function MatchHistory({
  items,
  now,
  hrefFor,
  label = "Últimas partidas",
  showRank = true,
}: {
  items: readonly HistoryItem[];
  now: Date;
  hrefFor: (item: HistoryItem) => string | null;
  label?: string;
  /** false: no rank or RR anywhere (public profile with the rank hidden). */
  showRank?: boolean;
}) {
  const days = groupByDay(items, now);
  let index = 0;
  return (
    <StaggerList ordered aria-label={label} className="flex flex-col">
      {days.map((day) => (
        <li key={day.key} className="flex flex-col">
          <h3 className="flex min-h-9 items-center justify-between gap-3 border-y border-line bg-surface-2/60 px-4 py-1.5 text-label">
            <span className="font-medium text-fg-secondary">{day.label}</span>
            <span className="num flex items-center gap-3 font-normal text-fg-muted">
              <span>
                <span aria-hidden="true">
                  {day.wins}V {day.losses}D{day.draws ? ` ${day.draws}E` : ""}
                </span>
                <span className="sr-only">
                  {day.wins} {day.wins === 1 ? "vitória" : "vitórias"}, {day.losses} {day.losses === 1 ? "derrota" : "derrotas"}
                  {day.draws ? `, ${day.draws} ${day.draws === 1 ? "empate" : "empates"}` : ""}
                </span>
              </span>
              {showRank && day.competitive > 0 ? <RrDelta value={day.rr} /> : null}
            </span>
          </h3>
          <ul className="divide-y divide-line">
            {day.items.map((item) => (
              <li key={item.matchId} className="stagger-item" style={{ "--i": index++ } as React.CSSProperties}>
                <HistoryRow item={item} now={now} href={hrefFor(item)} showRank={showRank} />
              </li>
            ))}
          </ul>
        </li>
      ))}
    </StaggerList>
  );
}
