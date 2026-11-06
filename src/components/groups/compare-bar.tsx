"use client";

import { useValueMotion } from "@/components/motion/motion-scope";
import { cn } from "@/lib/utils";

/**
 * One side's bar in the 1x1 comparison. Drawn full width and scaled
 * (transform only) so it can follow its number: it glides over 700ms when a
 * filter or player change moves it, and jumps on a background refresh.
 */
export function CompareBar({
  ratio,
  from,
  className,
}: {
  /** 0–1 share of the track */
  ratio: number;
  /** The end the bar grows from */
  from: "left" | "right";
  className?: string;
}) {
  const animate = useValueMotion(ratio);
  return (
    <span
      className={cn(
        "block h-full w-full rounded-full motion-reduce:transition-none",
        from === "right" ? "origin-right" : "origin-left",
        animate && "transition-transform duration-700 ease-(--ease-out)",
        className,
      )}
      style={{ transform: `scaleX(${ratio})` }}
    />
  );
}
