import { AgentsBreakdownSkeleton } from "@/components/agents/agents-table";
import { HistoryRowSkeleton } from "@/components/history/history-row";
import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the member profile: header, mode filter, agents, matches. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-6 sm:py-8" aria-busy="true" aria-label="Carregando o perfil">
      <Skeleton className="h-8 w-32 rounded-control" />
      <div className="flex items-center gap-4">
        <Skeleton className="size-12 rounded-full" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>
      <Skeleton className="h-11 w-56 rounded-control sm:h-9" />
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-24" />
        </div>
        <AgentsBreakdownSkeleton />
      </div>
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        <div className="border-b border-line px-4 py-3">
          <Skeleton className="h-4 w-36" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <HistoryRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
