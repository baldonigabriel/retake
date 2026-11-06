"use client";

import { ChevronDown, LoaderCircle } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option = { value: string; label: string };

/** Styled native select: keyboard, screen reader and mobile pickers for free. */
function FilterSelect({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string;
  allLabel: string;
  options: readonly Option[];
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative flex min-w-0 flex-1 sm:flex-none">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full min-w-0 cursor-pointer appearance-none rounded-control bg-surface-2 py-1.5 pr-8 pl-3 text-label text-fg shadow-hairline outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-primary),0_0_0_3px_rgba(255,70,85,0.25)] sm:min-h-8 sm:w-44"
      >
        <option value="">{allLabel}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-fg-muted" />
    </label>
  );
}

/**
 * Filters (?agent=, ?map=) and "Carregar mais" (?show=) for the match
 * history. URL-backed so a view can be shared; each change is a transition
 * that dims only this list (DESIGN.md › Troca de filtro: 60%, no skeleton)
 * until the server sends the new rows. Changing a filter starts again from
 * the first page.
 */
export function HistoryShell({
  agents,
  maps,
  agent,
  map,
  shown,
  total,
  pageSize,
  toolbarExtra,
  children,
}: {
  agents?: readonly Option[];
  maps?: readonly Option[];
  agent?: string;
  map?: string;
  shown: number;
  total: number;
  pageSize: number;
  toolbarExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [loadingMore, startLoadMore] = useTransition();

  function go(change: Record<string, string | null>, start: typeof startTransition) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(change)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    const query = params.toString();
    start(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
  }

  const remaining = total - shown;
  const hasFilters = (agents && agents.length > 1) || (maps && maps.length > 1);

  return (
    <>
      {hasFilters || toolbarExtra ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-3">
          {agents && agents.length > 1 ? (
            <FilterSelect
              label="Filtrar por agente"
              allLabel="Todos os agentes"
              options={agents}
              value={agent ?? ""}
              onChange={(v) => go({ agent: v || null, show: null }, startTransition)}
            />
          ) : null}
          {maps && maps.length > 1 ? (
            <FilterSelect
              label="Filtrar por mapa"
              allLabel="Todos os mapas"
              options={maps}
              value={map ?? ""}
              onChange={(v) => go({ map: v || null, show: null }, startTransition)}
            />
          ) : null}
          {toolbarExtra}
        </div>
      ) : null}
      <div
        aria-busy={pending || undefined}
        className={cn("transition-opacity duration-150 ease-(--ease-out)", pending && "opacity-60")}
      >
        {children}
      </div>
      {remaining > 0 ? (
        <div className="border-t border-line p-3">
          <Button
            type="button"
            variant="ghost"
            className="w-full"
            disabled={loadingMore}
            aria-busy={loadingMore || undefined}
            onClick={() => go({ show: String(shown + pageSize) }, startLoadMore)}
          >
            {loadingMore ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
            {loadingMore ? "Carregando…" : `Carregar mais (${remaining} ${remaining === 1 ? "restante" : "restantes"})`}
          </Button>
        </div>
      ) : null}
    </>
  );
}
