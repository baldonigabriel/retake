"use client";

import { createContext, use, useState } from "react";

/**
 * What the numbers on screen are currently filtered by (the URL query, set
 * by FilterProvider). A value that changes together with the scope changed
 * because the user picked another filter, so it may animate. A value that
 * changes with the same scope came from a refresh (sync in the background,
 * "Sincronizar agora") and is shown directly (DESIGN.md › Movimento).
 */
export const MotionScope = createContext("");

/**
 * Whether the latest change of `value` should animate. True on first display;
 * after that, only when the scope changed with it and it is still the same
 * quantity (`kind`): ACS → K/D is another number, not the same one changing.
 */
export function useValueMotion(value: number | null, kind = ""): boolean {
  const scope = use(MotionScope);
  const [last, setLast] = useState({ value, scope, kind });
  const [animate, setAnimate] = useState(true);
  // Adjusting state while rendering (React's pattern for "previous props").
  if (value !== last.value || scope !== last.scope || kind !== last.kind) {
    setLast({ value, scope, kind });
    if (value !== last.value) setAnimate(scope !== last.scope && kind === last.kind);
  }
  return animate;
}
