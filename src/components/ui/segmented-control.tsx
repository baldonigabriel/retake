"use client";

import { cn } from "@/lib/utils";

/**
 * Compact single-choice switch (metric, mode, period). Switching is something
 * users do all day, so it does NOT animate (DESIGN.md › Movimento).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex max-w-full overflow-x-auto rounded-control bg-surface-2 p-0.5 shadow-hairline",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "hover-layer press relative min-h-11 shrink-0 rounded-[4px] px-3 text-label whitespace-nowrap [--hover-bg:rgb(255_255_255/0.04)] sm:min-h-8",
              active
                ? "bg-surface-3 text-fg shadow-key"
                : "text-fg-secondary hover:text-fg focus-visible:text-fg",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
