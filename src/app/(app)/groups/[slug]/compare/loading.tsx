import { Skeleton } from "@/components/ui/skeleton";

/** Shaped like the comparison: header, pickers + filters, the mirrored metric card, the duo list. */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-8 sm:py-10" aria-busy="true" aria-label="Carregando comparação">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-52" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="flex flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <Skeleton className="h-11 rounded-control sm:h-10" />
          <Skeleton className="size-11 rounded-control sm:size-10" />
          <Skeleton className="h-11 rounded-control sm:h-10" />
        </div>
        <Skeleton className="h-11 w-60 rounded-control sm:h-9" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline lg:col-span-7 lg:mt-[21px]">
          <div className="flex items-center justify-between px-4 py-4 sm:px-5">
            <Skeleton className="h-10 w-36" />
            <Skeleton className="h-10 w-36" />
          </div>
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="grid grid-cols-[1fr_64px_1fr] items-center gap-3 border-t border-line px-4 py-3 sm:grid-cols-[1fr_96px_1fr] sm:px-5">
              <Skeleton className="ml-auto h-9 w-full max-w-40" />
              <Skeleton className="mx-auto h-3 w-10" />
              <Skeleton className="h-9 w-full max-w-40" />
            </div>
          ))}
        </div>
        <Skeleton className="h-72 rounded-card lg:col-span-5 lg:mt-[21px]" />
      </div>
    </div>
  );
}
