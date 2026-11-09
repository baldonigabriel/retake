import { Skeleton } from "@/components/ui/skeleton";

/** Same shape as the search: title, field and a few result rows. */
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 py-8 sm:py-10" aria-busy="true" aria-label="Carregando a busca">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <Skeleton className="h-11 w-full rounded-control sm:h-10" />
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="flex min-h-16 items-center gap-3 border-t border-line px-4 py-3 first:border-t-0">
            <Skeleton className="size-10 rounded-control" />
            <Skeleton className="h-4 w-40" />
          </div>
        ))}
      </div>
    </div>
  );
}
