import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-4 py-8 sm:py-10" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-56 w-full rounded-card" />
    </div>
  );
}
