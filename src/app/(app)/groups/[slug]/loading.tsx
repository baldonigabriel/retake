import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the group page: header, filters, ranking, MVP, members, together. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-8 sm:py-10" aria-busy="true" aria-label="Carregando grupo">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Skeleton className="h-11 w-56 rounded-control sm:h-9" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-start">
        <Skeleton className="h-56 rounded-card lg:col-span-5 lg:col-start-8 lg:row-start-1" />
        <div className="flex flex-col gap-4 lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:row-start-1">
        <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-8 w-48 rounded-control" />
          </div>
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex min-h-14 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
              <Skeleton className="h-5 w-6" />
              <Skeleton className="size-8 rounded-full" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
              <Skeleton className="h-6 w-12" />
            </div>
          ))}
        </div>
        <Skeleton className="h-64 rounded-card" />
        </div>
        <Skeleton className="h-48 rounded-card lg:col-span-5 lg:col-start-8 lg:row-start-2" />
      </div>
    </div>
  );
}
