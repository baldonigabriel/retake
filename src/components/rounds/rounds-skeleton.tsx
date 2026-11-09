import { Skeleton } from "@/components/ui/skeleton";

export function RoundBreakdownsSkeleton() {
  return (
    <>
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        <div className="border-b border-line px-4 py-3"><Skeleton className="h-4 w-20" /></div>
        <div className="grid grid-cols-2 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="border-r border-line p-4"><Skeleton className="h-3 w-20" /><Skeleton className="mt-2 h-7 w-16" /><Skeleton className="mt-2 h-3 w-24" /></div>
          ))}
        </div>
        <Skeleton className="m-4 h-32 w-[calc(100%-2rem)]" />
      </div>
      <div className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        <div className="border-b border-line px-4 py-3"><Skeleton className="h-4 w-16" /><Skeleton className="mt-2 h-3 w-64 max-w-full" /></div>
        {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="mx-4 my-3 h-6 w-[calc(100%-2rem)]" />)}
      </div>
    </>
  );
}
