"use client";

import { useLayoutEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/** Puts the indicator under the pressed option: translateX to it, scaleX to its width. */
function place(
  list: HTMLElement | null,
  indicator: HTMLElement | null,
  base: { current: number },
  animate: boolean,
) {
  const active = list?.querySelector<HTMLElement>('[aria-pressed="true"]');
  if (!list || !indicator || !active) return;
  if (!animate || !base.current) {
    // Jump: re-base the width so the indicator rests at scale 1.
    base.current = active.offsetWidth;
    indicator.style.transition = "none";
    indicator.style.width = `${base.current}px`;
  } else {
    indicator.style.transition = "";
  }
  indicator.style.transform = `translateX(${active.offsetLeft}px) scaleX(${active.offsetWidth / base.current})`;
  list.dataset.ready = "";
}

/**
 * Compact single-choice switch (metric, mode, period, week).
 * DESIGN.md › Movimento › Listas e estados: one indicator slides to the picked
 * option in 200ms, as soon as it is clicked (the URL and data follow in a
 * transition). It moves with transform only: translateX to the option and
 * scaleX to its width. Keyboard picks and resizes jump without sliding, and
 * so does everything under reduced motion. Until hydration measures the
 * options, the active one paints its own background (same look, no flash).
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
  // Optimistic choice: shown right away, dropped once `value` catches up.
  const [picked, setPicked] = useState<{ value: T; from: T } | null>(null);
  const shown = picked && picked.from === value ? picked.value : value;

  const listRef = useRef<HTMLDivElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const glide = useRef(false);
  const base = useRef(0);

  // Move the indicator to the active option (after each pick).
  useLayoutEffect(() => {
    place(listRef.current, indicatorRef.current, base, glide.current);
    glide.current = false;
  }, [shown]);

  // Re-place without sliding when the control resizes (fonts, viewport).
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let first = true;
    const observer = new ResizeObserver(() => {
      // The initial notification would cancel a slide in flight.
      if (first) first = false;
      else place(list, indicatorRef.current, base, false);
    });
    observer.observe(list);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={listRef}
      role="group"
      aria-label={label}
      className={cn(
        "group/seg relative inline-flex max-w-full overflow-x-auto rounded-control bg-surface-2 p-0.5 shadow-hairline",
        className,
      )}
    >
      <span
        ref={indicatorRef}
        aria-hidden="true"
        className="pointer-events-none absolute top-0.5 bottom-0.5 left-0 origin-left rounded-[4px] bg-surface-3 opacity-0 shadow-key transition-transform duration-200 ease-(--ease-out) group-data-ready/seg:opacity-100 motion-reduce:transition-none"
      />
      {options.map((opt) => {
        const active = opt.value === shown;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={(event) => {
              if (opt.value === shown) return;
              // detail 0 = keyboard (Enter/Space): no slide for keyboard actions.
              glide.current = event.detail > 0;
              setPicked({ value: opt.value, from: value });
              onChange(opt.value);
            }}
            className={cn(
              "hover-layer press relative min-h-11 shrink-0 rounded-[4px] px-3 text-label whitespace-nowrap [--hover-bg:rgb(255_255_255/0.04)] sm:min-h-8",
              active
                ? "bg-surface-3 text-fg shadow-key group-data-ready/seg:bg-transparent group-data-ready/seg:shadow-none"
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
