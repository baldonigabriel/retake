"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { useValueMotion } from "@/components/motion/motion-scope";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/**
 * Share of the votes as a bar (transform only). It grows from zero the first
 * time it shows up in the browser and slides when the viewer's own vote moves
 * it; refreshes from other people's votes swap it directly (useValueMotion).
 */
export function VoteBar({ share, mine }: { share: number; mine: boolean }) {
  const animate = useValueMotion(share, "share");
  const mountedInBrowser = useSyncExternalStore(noop, () => true, () => false);
  const [grow, setGrow] = useState(
    () => mountedInBrowser && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === false,
  );
  useEffect(() => {
    if (!grow) return;
    const frame = requestAnimationFrame(() => setGrow(false));
    return () => cancelAnimationFrame(frame);
  }, [grow]);
  return (
    <span aria-hidden="true" className="block h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
      <span
        className={cn(
          "block h-full origin-left rounded-full",
          mine ? "bg-fg" : "bg-fg-muted",
          animate && "transition-transform duration-300 ease-(--ease-out) motion-reduce:transition-none",
        )}
        style={{ transform: `scaleX(${grow ? 0 : share})` }}
      />
    </span>
  );
}

