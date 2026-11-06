"use client";

import { useRouter } from "next/navigation";
import { useId, useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { saveBagreSettingsAction } from "@/app/(app)/groups/bagre-actions";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { CADENCE_LABEL, CADENCES, type Cadence } from "@/lib/bagre/period";
import { cn } from "@/lib/utils";

type Settings = { enabled: boolean; cadence: Cadence };

/**
 * Owner's Bagre switch and cadence. Saves on change: the control flips at
 * once (optimistic) and goes back with a toast if the server says no.
 */
export function BagreSettings({ groupId, enabled, cadence }: { groupId: string; enabled: boolean; cadence: Cadence }) {
  const router = useRouter();
  const id = useId();
  const [pending, startTransition] = useTransition();
  const [shown, setShown] = useOptimistic<Settings, Settings>({ enabled, cadence }, (_, next) => next);

  function save(next: Settings) {
    startTransition(async () => {
      setShown(next);
      const result = await saveBagreSettingsAction({ groupId, ...next });
      if (!result.ok) {
        toast.error("Não deu para salvar", { description: result.message });
        return;
      }
      toast.success(
        next.enabled === shown.enabled ? "Frequência salva" : next.enabled ? "Bagre ligado" : "Bagre desligado",
        {
          description:
            next.enabled === shown.enabled
              ? "Vale a partir do próximo período. O atual termina na data de sempre."
              : next.enabled
                ? "O grupo já pode indicar e votar."
                : "Ninguém indica nem vota até você religar.",
        },
      );
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4" aria-busy={pending}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <span id={`${id}-label`} className="font-medium text-fg">
            Votação do Bagre
          </span>
          <span id={`${id}-hint`} className="text-fg-secondary">
            {shown.enabled ? "Ligado: o grupo indica e vota." : "Desligado: a votação some do grupo e o período atual encerra sem resultado."}
          </span>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={shown.enabled}
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-hint`}
          disabled={pending}
          onClick={() => save({ ...shown, enabled: !shown.enabled })}
          className="press group/switch relative inline-flex min-h-11 shrink-0 items-center rounded-full px-0.5 outline-none disabled:opacity-60 sm:min-h-8"
        >
          <span
            aria-hidden="true"
            className={cn(
              "relative inline-flex h-6 w-10 items-center rounded-full shadow-hairline group-focus-visible/switch:ring-2 group-focus-visible/switch:ring-primary group-focus-visible/switch:ring-offset-2 group-focus-visible/switch:ring-offset-surface-1",
              shown.enabled ? "bg-paper" : "bg-surface-3",
            )}
          >
            <span
              className={cn(
                "size-5 rounded-full shadow-key transition-transform duration-150 ease-(--ease-out) motion-reduce:transition-none",
                shown.enabled ? "translate-x-[18px] bg-surface-1" : "translate-x-0.5 bg-fg-secondary",
              )}
            />
          </span>
        </button>
      </div>
      <div className={cn("flex flex-col gap-2 border-t border-line pt-4", !shown.enabled && "opacity-60")}>
        <span className="text-label text-fg-secondary">Frequência</span>
        <SegmentedControl
          label="Frequência do Bagre"
          options={CADENCES.map((c) => ({ value: c, label: CADENCE_LABEL[c] }))}
          value={shown.cadence}
          onChange={(c) => save({ ...shown, cadence: c })}
          className="w-fit"
        />
        <p className="text-label font-normal text-fg-muted">
          Semanal vai de segunda a domingo; diário, da 0h às 23h59. Sempre no horário de Brasília. A troca vale a partir do
          próximo período.
        </p>
      </div>
    </div>
  );
}
