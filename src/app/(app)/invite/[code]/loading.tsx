import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col py-12 sm:py-16" aria-busy="true" aria-label="Carregando convite">
      <div className="flex flex-col gap-5 rounded-card-lg bg-surface-1 p-5 shadow-hairline sm:p-6">
        <Skeleton className="h-3 w-32" />
        <div className="flex items-center gap-3">
          <Skeleton className="size-12 rounded-card" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
        <Skeleton className="h-14 w-full" />
        <Skeleton className="h-10 w-36 rounded-control" />
      </div>
    </div>
  );
}
