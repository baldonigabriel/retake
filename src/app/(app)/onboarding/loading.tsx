import { OnboardingShell } from "@/components/onboarding/onboarding-shell";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <OnboardingShell>
      <div className="flex flex-col gap-6" aria-busy="true" aria-label="Carregando">
        <Skeleton className="h-5 w-64" />
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-11 w-full rounded-control sm:h-10" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-11 w-full rounded-control sm:h-10 sm:w-36" />
      </div>
    </OnboardingShell>
  );
}
