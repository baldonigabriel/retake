import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-8 sm:py-10" aria-busy="true" aria-label="Carregando grupos">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline lg:col-span-7">
          <div className="border-b border-line px-4 py-3">
            <Skeleton className="h-4 w-28" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex min-h-16 items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
              <Skeleton className="size-9 rounded-control" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-3.5 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5 lg:col-span-5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-10 w-full rounded-control" />
          <Skeleton className="h-10 w-full rounded-control" />
          <Skeleton className="h-10 w-32 rounded-control" />
        </div>
      </div>
    </div>
  );
}
