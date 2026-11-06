"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { createContext, use, useTransition } from "react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import { cn } from "@/lib/utils";

const PendingContext = createContext<{
  pending: boolean;
  navigate: (key: string, value: string, fallback: string) => void;
  startTransition: (callback: () => void) => void;
}>({
  pending: false,
  navigate: () => {},
  startTransition: (callback) => callback(),
});

/**
 * Filters live in the URL (?mode=&period=) so a view can be shared. Changing
 * one is a transition: the current numbers stay on screen (dimmed, no
 * skeleton flash) until the new ones arrive. Switching filters is done all
 * day, so nothing moves (DESIGN.md › Movimento).
 */
export function FilterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  function navigate(key: string, value: string, fallback: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === fallback) params.delete(key);
    else params.set(key, value);
    const query = params.toString();
    startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  return <PendingContext value={{ pending, navigate, startTransition }}>{children}</PendingContext>;
}

/** `navigate(key, value, fallback)` for filter controls other than FilterBar. */
export function useFilterNavigation() {
  return use(PendingContext).navigate;
}

/** The shared transition, for controls that change several params at once. */
export function useFilterTransition() {
  return use(PendingContext).startTransition;
}

export function FilterBar({
  modes,
  mode,
  defaultMode,
  periods,
  period,
  defaultPeriod,
}: {
  modes: readonly { value: string; label: string }[];
  mode: string;
  defaultMode: string;
  periods: readonly { value: string; label: string }[];
  period: string;
  defaultPeriod: string;
}) {
  const { navigate } = use(PendingContext);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {modes.length > 1 ? (
        <SegmentedControl label="Modo" options={modes} value={mode} onChange={(v) => navigate("mode", v, defaultMode)} />
      ) : null}
      <SegmentedControl label="Período" options={periods} value={period} onChange={(v) => navigate("period", v, defaultPeriod)} />
    </div>
  );
}

/** Content that depends on the filters; dimmed while the next view loads. */
export function FilteredContent({ children, className }: { children: React.ReactNode; className?: string }) {
  const { pending } = use(PendingContext);
  return (
    <div aria-busy={pending || undefined} className={cn(pending && "opacity-60", className)}>
      {children}
    </div>
  );
}
