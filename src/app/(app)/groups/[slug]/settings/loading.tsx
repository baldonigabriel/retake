import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex max-w-2xl flex-col gap-4 py-6 sm:py-8" aria-busy="true" aria-label="Carregando ajustes do grupo">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-8 w-56" />
      {[40, 44, 56, 24].map((h, i) => (
        <div key={i} className="flex flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="w-full" style={{ height: h * 2 }} />
        </div>
      ))}
    </div>
  );
}
