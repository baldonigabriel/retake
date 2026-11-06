"use client";

import { ArrowLeftRight, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId } from "react";

import { useFilterTransition } from "@/components/dashboard/dashboard-filters";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

/**
 * Two native selects (keyboard and screen readers for free, the OS picker on
 * phones) plus a swap button. Choosing players is a filter: the URL changes
 * (?a=&b=), nothing animates, and the current numbers stay dimmed until the
 * new ones arrive.
 */
export function ComparePicker({ options, a, b }: { options: readonly Option[]; a: string; b: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const startTransition = useFilterTransition();
  const id = useId();

  function go(nextA: string, nextB: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("a", nextA);
    params.set("b", nextB);
    startTransition(() => router.replace(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  // Picking the player already on the other side swaps them instead of comparing someone with themselves.
  const pickA = (value: string) => (value === b ? go(b, a) : go(value, b));
  const pickB = (value: string) => (value === a ? go(b, a) : go(a, value));

  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
      <PlayerSelect id={`${id}-a`} label="Jogador 1" dot="bg-primary" value={a} options={options} onChange={pickA} />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => go(b, a)}
        aria-label="Trocar os lados"
        title="Trocar os lados"
      >
        <ArrowLeftRight aria-hidden="true" />
      </Button>
      <PlayerSelect id={`${id}-b`} label="Jogador 2" dot="bg-paper" value={b} options={options} onChange={pickB} />
    </div>
  );
}

function PlayerSelect({
  id,
  label,
  dot,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  dot: string;
  value: string;
  options: readonly Option[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-label text-fg-secondary">
        <span aria-hidden="true" className={cn("size-2 rounded-full", dot)} />
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-11 w-full min-w-0 cursor-pointer appearance-none truncate rounded-control border border-line bg-surface-2 py-2.5 pr-9 pl-3 text-base text-fg outline-none hover:border-line-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25 sm:min-h-10 sm:text-body-sm"
        >
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted" />
      </div>
    </div>
  );
}
