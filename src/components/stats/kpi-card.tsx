import { DeltaChip } from "@/components/stats/delta-chip";
import { Sparkline } from "@/components/stats/sparkline";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** DESIGN.md › Card de KPI: eyebrow, stat-lg number, delta chip, optional sparkline. */
export function KpiCard({
  label,
  value,
  delta,
  deltaDigits = 1,
  lowerIsBetter,
  trend,
  hint,
  className,
}: {
  label: string;
  value: string;
  delta?: number;
  deltaDigits?: number;
  lowerIsBetter?: boolean;
  trend?: readonly number[];
  /** Formula or explanation, read by screen readers and shown as `title` */
  hint?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-eyebrow text-fg-muted uppercase" title={hint}>
          {label}
          {hint ? <span className="sr-only">: {hint}</span> : null}
        </p>
        {trend ? <Sparkline data={trend} width={48} height={16} /> : null}
      </div>
      <p className="stat text-stat-lg text-fg">{value}</p>
      {delta !== undefined ? (
        <DeltaChip
          value={delta}
          digits={deltaDigits}
          lowerIsBetter={lowerIsBetter}
          suffix="vs. sua média"
        />
      ) : null}
    </div>
  );
}

export function KpiCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5",
        className,
      )}
    >
      <Skeleton className="h-3 w-12" />
      <Skeleton className="h-12 w-24" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}
