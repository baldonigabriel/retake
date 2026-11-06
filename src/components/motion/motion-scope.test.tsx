import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { MotionScope, useValueMotion } from "./motion-scope";

// The wrapper reads the scope from here so rerenders can change it.
let current = { scope: "" };

function setup(initial: { value: number | null; scope: string; kind?: string }) {
  return renderHook(({ value, kind }) => useValueMotion(value, kind), {
    initialProps: initial,
    wrapper: ({ children }) => <MotionScope value={current.scope}>{children}</MotionScope>,
  });
}

describe("useValueMotion", () => {
  it("animates the first display", () => {
    current = { scope: "mode=competitive" };
    const { result } = setup({ value: 224, scope: current.scope });
    expect(result.current).toBe(true);
  });

  it("rolls when a filter changes the value", () => {
    current = { scope: "" };
    const hook = setup({ value: 224, scope: "" });
    current = { scope: "mode=unrated" };
    hook.rerender({ value: 203, scope: current.scope });
    expect(hook.result.current).toBe(true);
  });

  it("swaps directly when the value changes without a filter change (background sync)", () => {
    current = { scope: "" };
    const hook = setup({ value: 224, scope: "" });
    hook.rerender({ value: 226, scope: "" });
    expect(hook.result.current).toBe(false);
    // …and a later filter change rolls again.
    current = { scope: "period=30d" };
    hook.rerender({ value: 230, scope: current.scope });
    expect(hook.result.current).toBe(true);
  });

  it("swaps directly when the quantity changes (ACS → K/D)", () => {
    current = { scope: "" };
    const hook = setup({ value: 224, scope: "", kind: "acs" });
    current = { scope: "metric=kd" };
    hook.rerender({ value: 1.1, scope: current.scope, kind: "kd" });
    expect(hook.result.current).toBe(false);
  });
});
