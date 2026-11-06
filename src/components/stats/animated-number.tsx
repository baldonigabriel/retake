"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useState, useSyncExternalStore } from "react";

import { useValueMotion } from "@/components/motion/motion-scope";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/** DESIGN.md › Movimento › contagem de números: 700ms, strong ease-out. */
const ROLL = { duration: 700, easing: "cubic-bezier(0.23, 1, 0.32, 1)" } as const;
const FADE = { duration: 300, easing: "ease-out" } as const;

const noop = () => () => {};

/**
 * A stat number that rolls to its new value (pt-BR, tabular figures):
 * - on first display in the browser (client navigation, new content) it
 *   counts up from zero. A full page load already has the final number in
 *   the HTML and doesn't count, so nobody reads a wrong value before JS loads;
 * - when a filter changes it, it rolls from the old value;
 * - background refreshes and a change of quantity (`kind`) swap it directly;
 * - reduced motion: NumberFlow swaps it directly.
 * The final text reserves the width up front (nothing beside it moves), and
 * screen readers get only the final value.
 */
export function AnimatedNumber({
  value,
  digits = 0,
  suffix,
  kind,
  align = "start",
  className,
}: {
  value: number | null;
  /** Fixed decimal places, same as the static formatting */
  digits?: number;
  /** "%" for rates */
  suffix?: string;
  /** The quantity shown (e.g. the ranking metric); changing it never rolls */
  kind?: string;
  align?: "start" | "end";
  className?: string;
}) {
  const animated = useValueMotion(value, kind);
  // false while hydrating server HTML, true for components mounted in the browser
  const mountedInBrowser = useSyncExternalStore(noop, () => true, () => false);
  const [fromZero, setFromZero] = useState(
    () => mountedInBrowser && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === false,
  );
  useEffect(() => {
    if (!fromZero) return;
    const frame = requestAnimationFrame(() => setFromZero(false));
    return () => cancelAnimationFrame(frame);
  }, [fromZero]);

  if (value === null) return <span className={className}>—</span>;
  const text = `${formatNumber(value, digits)}${suffix ?? ""}`;

  return (
    <span className={cn("inline-grid tabular-nums", className)}>
      {/* Reserves the final width: generated content, so it is not page text. */}
      <span
        aria-hidden="true"
        data-text={text}
        className="invisible col-start-1 row-start-1 whitespace-nowrap before:content-[attr(data-text)]"
      />
      <NumberFlow
        aria-hidden="true"
        className={cn("number-roll col-start-1 row-start-1", align === "end" ? "justify-self-end" : "justify-self-start")}
        value={fromZero ? 0 : value}
        locales="pt-BR"
        format={{ minimumFractionDigits: digits, maximumFractionDigits: digits }}
        suffix={suffix}
        animated={animated}
        transformTiming={ROLL}
        spinTiming={ROLL}
        opacityTiming={FADE}
      />
      <span className="sr-only">{text}</span>
    </span>
  );
}
