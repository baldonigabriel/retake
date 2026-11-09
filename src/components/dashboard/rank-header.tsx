import { DeltaChip } from "@/components/stats/delta-chip";
import { Sparkline } from "@/components/stats/sparkline";
import { ChamferCard } from "@/components/ui/chamfer-card";
import type { RankPoint } from "@/lib/dashboard/queries";
import { formatNumber } from "@/lib/format";
import { tierIconUrl, tierLabel } from "@/lib/ranks";

/** Rank progress on one axis: tier steps of 100 + RR inside the tier. */
const ladder = (p: RankPoint) => p.elo ?? p.tier * 100 + p.rr;

/**
 * DESIGN.md › the screen's single chamfered highlight: current rank, RR,
 * last change and a mini chart of the recent competitive history.
 */
export function RankHeader({
  history,
  emptyHint = "Jogue uma competitiva para acompanhar seu rank e RR aqui.",
}: {
  history: readonly RankPoint[];
  /** Copy when there's no rank yet (someone else's profile says it differently). */
  emptyHint?: string;
}) {
  const current = history.at(-1);

  if (!current) {
    return (
      <ChamferCard>
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow text-fg-muted uppercase">Rank competitivo</p>
          <p className="stat text-stat-md text-fg">Sem rank ainda</p>
          <p className="text-fg-secondary">{emptyHint}</p>
        </div>
      </ChamferCard>
    );
  }

  const first = history[0]!;
  const net = ladder(current) - ladder(first);
  const icon = tierIconUrl(current.tier);
  const label = tierLabel(current.tier, current.tierName);

  return (
    <ChamferCard>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="size-12 shrink-0 bg-contain bg-center bg-no-repeat sm:size-14"
            style={icon ? { backgroundImage: `url(${icon})` } : undefined}
          />
          <div className="flex flex-col gap-1.5">
            <p className="text-eyebrow text-fg-muted uppercase">Rank competitivo</p>
            <p className="flex items-baseline gap-3">
              <span className="stat text-stat-lg text-fg">{label}</span>
              <span className="stat text-[24px] leading-none font-semibold text-fg-secondary">
                {formatNumber(current.rr)} <span className="text-[18px]">RR</span>
              </span>
            </p>
            {current.rrChange !== null ? (
              <DeltaChip value={current.rrChange} digits={0} suffix="RR na última partida" />
            ) : null}
          </div>
        </div>

        {history.length >= 2 ? (
          <div className="flex items-center gap-4 border-t border-line pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
            <Sparkline data={history.map(ladder)} width={168} height={40} className="text-primary" />
            <div className="flex flex-col gap-1">
              <p className="text-eyebrow text-fg-muted uppercase">
                Últimas {history.length} competitivas
              </p>
              <DeltaChip value={net} digits={0} suffix="RR no total" />
            </div>
          </div>
        ) : null}
      </div>
    </ChamferCard>
  );
}
