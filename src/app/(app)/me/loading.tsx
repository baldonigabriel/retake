import { MatchRowSkeleton } from "@/components/match/match-row";
import { KpiCardSkeleton } from "@/components/stats/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as /me: header, rank card, filters, KPIs, chart, tables, list. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-8 sm:py-10" aria-busy="true" aria-label="Carregando seu painel">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="flex h-[112px] items-center gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
        <Skeleton className="size-12 rounded-full sm:size-14" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-11 w-56 rounded-control sm:h-9" />
        <Skeleton className="h-11 w-44 rounded-control sm:h-9" />
      </div>
      <Skeleton className="h-3 w-40" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <KpiCardSkeleton key={i} className={i === 4 ? "col-span-2 sm:col-span-1" : undefined} />
        ))}
      </div>
      <div className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-56 w-full sm:h-64" />
      </div>
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="grid lg:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <Skeleton className="size-9 rounded-control" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-full max-w-sm" />
                <Skeleton className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-36" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <MatchRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
