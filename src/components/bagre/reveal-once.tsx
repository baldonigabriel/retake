"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const noop = () => () => {};
const KEY = "retake:bagre-seen";

function seen(id: string): boolean {
  try {
    return (localStorage.getItem(KEY) ?? "").split(",").includes(id);
  } catch {
    return true; // storage blocked: don't animate rather than animate every time
  }
}

function markSeen(id: string) {
  try {
    const ids = (localStorage.getItem(KEY) ?? "").split(",").filter(Boolean);
    if (!ids.includes(id)) localStorage.setItem(KEY, [...ids.slice(-19), id].join(","));
  } catch {
    // Private mode or blocked storage: nothing to remember.
  }
}

/**
 * The result reveal (DESIGN.md › Movimento › Destaques): the first time a
 * viewer opens a result in the browser it enters with fade + scale(0.98),
 * and the numbers inside count up. A full page load shows it ready (the
 * value is in the HTML from the first instant), and it never replays for
 * the same period on this device.
 */
export function RevealOnce({ id, className, children }: { id: string; className?: string; children: React.ReactNode }) {
  const mountedInBrowser = useSyncExternalStore(noop, () => true, () => false);
  const [reveal] = useState(() => mountedInBrowser && !seen(id));
  useEffect(() => markSeen(id), [id]);
  return (
    <div className={cn(reveal && "celebrate", className)} data-reveal={reveal || undefined}>
      {children}
    </div>
  );
}
