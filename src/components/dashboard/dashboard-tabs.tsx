"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";

import { useFilterTransition } from "@/components/dashboard/dashboard-filters";
import { cn } from "@/lib/utils";

/**
 * Section tabs of the dashboard (?tab=). Real links, so they work before
 * JavaScript, open in a new tab and keep the filters in the URL. Once
 * hydrated, a plain click switches inside the filters' transition: the tab
 * underline slides to the pick at once (200ms, transform only) while the
 * current content dims until the next one arrives (DESIGN.md › Movimento).
 * Keyboard activation and reduced motion jump without sliding.
 */
export function DashboardTabs({
  tabs,
  active,
  label = "Seções do painel",
}: {
  tabs: readonly { value: string; label: string; href: string }[];
  active: string;
  label?: string;
}) {
  const router = useRouter();
  const startTransition = useFilterTransition();
  const [picked, setPicked] = useState<{ value: string; from: string } | null>(null);
  const shown = picked && picked.from === active ? picked.value : active;

  const listRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLSpanElement>(null);
  const glide = useRef(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    const bar = barRef.current;
    const current = list?.querySelector<HTMLElement>('[data-active="true"]');
    if (!list || !bar || !current) return;
    bar.style.transition = glide.current ? "" : "none";
    // Same inset as the fallback underline: 12px on each side of the label.
    bar.style.transform = `translateX(${current.offsetLeft + 12}px) scaleX(${Math.max(1, current.offsetWidth - 24)})`;
    list.dataset.ready = "";
    glide.current = false;
    // Keep the picked tab in view on phones (the row scrolls sideways, never the page).
    const left = current.offsetLeft - 16;
    const right = current.offsetLeft + current.offsetWidth + 16 - list.clientWidth;
    if (list.scrollLeft > left) list.scrollLeft = left;
    else if (list.scrollLeft < right) list.scrollLeft = right;
  }, [shown]);

  return (
    <nav aria-label={label} className="-mx-4 border-b border-line sm:mx-0">
      <div ref={listRef} className="group/tabs no-scrollbar relative flex overflow-x-auto px-4 sm:px-0">
        {tabs.map((tab) => {
          const isActive = tab.value === shown;
          return (
            <Link
              key={tab.value}
              href={tab.href}
              scroll={false}
              data-active={isActive}
              aria-current={isActive ? "page" : undefined}
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                if (tab.value === shown) return;
                // detail 0 = keyboard (Enter): no slide for keyboard actions.
                glide.current = event.detail > 0;
                setPicked({ value: tab.value, from: active });
                startTransition(() => router.push(tab.href, { scroll: false }));
              }}
              className={cn(
                "hover-layer press relative inline-flex min-h-11 shrink-0 items-center rounded-control px-3 text-body-sm whitespace-nowrap [--hover-bg:rgb(255_255_255/0.04)] focus-visible:outline-offset-[-2px]",
                isActive ? "font-medium text-fg" : "text-fg-secondary hover:text-fg focus-visible:text-fg",
              )}
            >
              {tab.label}
              {/* Until the bar is measured, the active tab draws its own underline. */}
              {isActive ? (
                <span aria-hidden="true" className="absolute inset-x-3 bottom-0 h-0.5 bg-primary group-data-ready/tabs:opacity-0" />
              ) : null}
            </Link>
          );
        })}
        <span
          ref={barRef}
          aria-hidden="true"
          className="pointer-events-none absolute bottom-0 left-0 h-0.5 w-px origin-left bg-primary opacity-0 transition-transform duration-200 ease-(--ease-out) group-data-ready/tabs:opacity-100 motion-reduce:transition-none"
        />
      </div>
    </nav>
  );
}
