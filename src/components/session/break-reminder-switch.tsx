"use client";

import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { setBreakReminderAction } from "@/app/(app)/settings/actions";
import { cn } from "@/lib/utils";

/**
 * On/off for the "take a break" note. Optimistic: the thumb moves at once
 * (transform only, 150ms ease-out; the track colour swaps without a
 * transition, per DESIGN.md) and goes back if saving fails.
 */
export function BreakReminderSwitch({ on, labelledBy, describedBy }: { on: boolean; labelledBy: string; describedBy?: string }) {
  const [pending, startTransition] = useTransition();
  const [checked, setChecked] = useOptimistic(on);

  function toggle() {
    const next = !checked;
    startTransition(async () => {
      setChecked(next);
      const result = await setBreakReminderAction(next);
      if (!result.ok) {
        toast.error("Não deu para salvar", { description: result.message });
        return;
      }
      toast.success(next ? "Aviso de pausa ligado" : "Aviso de pausa desligado");
    });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-busy={pending || undefined}
      onClick={toggle}
      className="press group/switch relative inline-flex size-11 shrink-0 items-center justify-center rounded-control focus-visible:outline-offset-0 sm:h-8 sm:w-12"
    >
      <span
        aria-hidden="true"
        className={cn(
          "relative inline-flex h-6 w-10 items-center rounded-full shadow-hairline",
          checked ? "bg-primary" : "bg-surface-3",
        )}
      >
        <span
          className={cn(
            "motion-transform absolute left-0.5 size-5 rounded-full shadow-key transition-transform duration-150 ease-(--ease-out)",
            checked ? "translate-x-4 bg-on-accent" : "translate-x-0 bg-fg-secondary",
          )}
        />
      </span>
    </button>
  );
}
