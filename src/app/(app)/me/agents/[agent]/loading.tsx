import { HistoryRowSkeleton } from "@/components/history/history-row";
import { BackLink } from "@/components/match/back-link";
import { KpiCardSkeleton } from "@/components/stats/kpi-card";
import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the agent page: header, filters, 6 KPIs, chart, maps, matches. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-6 sm:py-8" aria-busy="true" aria-label="Carregando o agente">
      <BackLink />
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-11 w-40 rounded-control sm:h-9" />
        <Skeleton className="h-11 w-56 rounded-control sm:h-9" />
      </div>
      <Skeleton className="h-3 w-56" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <KpiCardSkeleton key={i} />
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
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
            <Skeleton className="h-7 w-12" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="ml-auto h-3.5 w-40 sm:w-72" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        {Array.from({ length: 4 }, (_, i) => (
          <HistoryRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
