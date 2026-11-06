import { AgentsBreakdownSkeleton } from "@/components/agents/agents-table";
import { HistoryRowSkeleton } from "@/components/history/history-row";
import { KpiCardSkeleton } from "@/components/stats/kpi-card";
import { GoalsPanelSkeleton } from "@/components/goals/goals-panel";
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
      <GoalsPanelSkeleton />
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
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="flex flex-col gap-1.5">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
          <Skeleton className="h-11 w-40 rounded-control sm:h-9" />
        </div>
        <AgentsBreakdownSkeleton />
      </div>
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-36" />
        </div>
        <div className="flex gap-2 border-b border-line px-4 py-3">
          <Skeleton className="h-11 flex-1 rounded-control sm:h-8 sm:w-44 sm:flex-none" />
          <Skeleton className="h-11 flex-1 rounded-control sm:h-8 sm:w-44 sm:flex-none" />
        </div>
        <div className="grid grid-cols-2 gap-4 border-b border-line p-4 sm:grid-cols-4 sm:p-5 lg:w-1/2">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <HistoryRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
