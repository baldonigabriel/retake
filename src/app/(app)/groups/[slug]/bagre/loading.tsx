import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the Bagre screen: header, nominations, result/suggestions, history. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-6 sm:py-8" aria-busy="true" aria-label="Carregando o Bagre">
      <Skeleton className="h-8 w-28 rounded-control" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-56" />
        </div>
        <Skeleton className="h-11 w-full rounded-control sm:h-10 sm:w-40" />
      </div>
      <div className="grid gap-4 pt-2 lg:grid-cols-12 lg:items-start">
        <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline lg:col-span-7">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <Skeleton className="h-4 w-36" />
            <Skeleton className="h-3 w-16" />
          </div>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0">
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="ml-auto h-8 w-20 rounded-control" />
              </div>
              <Skeleton className="ml-11 h-4 w-3/4" />
              <Skeleton className="ml-11 h-3 w-1/2" />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-4 lg:col-span-5">
          <Skeleton className="h-44 rounded-card" />
          <Skeleton className="h-48 rounded-card" />
        </div>
      </div>
      <Skeleton className="h-40 rounded-card" />
    </div>
  );
}
