import { BackLink } from "@/components/match/back-link";
import { Skeleton } from "@/components/ui/skeleton";

function TableSkeleton() {
  return (
    <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-5 w-14" />
        <Skeleton className="ml-auto h-6 w-8" />
      </div>
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
          <Skeleton className="size-7 rounded-full" />
          <Skeleton className="h-3.5 w-28" />
          <Skeleton className="ml-auto h-3.5 w-40 sm:w-80" />
        </div>
      ))}
    </div>
  );
}

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-6 sm:py-8" aria-busy="true" aria-label="Carregando a partida">
      <BackLink />
      <div className="flex flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-6">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-64" />
        <Skeleton className="h-3 w-52" />
      </div>
      <TableSkeleton />
      <TableSkeleton />
    </div>
  );
}
