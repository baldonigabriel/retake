"use client";

import { ChevronDown, LoaderCircle, Plus, Target } from "lucide-react";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { saveGoalAction } from "@/app/(app)/me/goal-actions";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { GOAL_METRICS, GOAL_SPEC, formatTarget, goalInputSchema, type GoalMetric } from "@/lib/goals/goals";
import { cn } from "@/lib/utils";

type Existing = { metric: GoalMetric; target: number };

/**
 * "Nova meta": a trigger that turns into an inline form in the same spot.
 * The form enters with a 240ms fade + 6px rise (occasional action, so it may
 * animate; reduced motion keeps only the fade). Esc or "Cancelar" close it and
 * focus returns to the trigger.
 *
 * With `empty`, the collapsed state is the panel's empty state, and its
 * action is the screen's one primary button.
 */
export function NewGoal({ existing, empty }: { existing: readonly Existing[]; empty?: boolean }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (wasOpen.current && !open) triggerRef.current?.focus();
    wasOpen.current = open;
  }, [open]);

  if (open) return <GoalForm existing={existing} onDone={() => setOpen(false)} />;

  if (empty) {
    return (
      <EmptyState
        icon={Target}
        title="Nenhuma meta para esta semana"
        description="Escolha um número para perseguir, como HS% acima de 25%. O progresso usa suas partidas competitivas da semana."
        action={
          <Button ref={triggerRef} type="button" onClick={() => setOpen(true)}>
            <Plus aria-hidden="true" />
            Criar meta
          </Button>
        }
      />
    );
  }

  return (
    <div className="border-t border-line px-2 py-2">
      <Button ref={triggerRef} type="button" variant="quiet" size="sm" onClick={() => setOpen(true)} className="w-full justify-start sm:w-fit">
        <Plus aria-hidden="true" />
        Nova meta
      </Button>
    </div>
  );
}

function GoalForm({ existing, onDone }: { existing: readonly Existing[]; onDone: () => void }) {
  const id = useId();
  const firstFree = GOAL_METRICS.find((m) => !existing.some((e) => e.metric === m)) ?? GOAL_METRICS[0];
  const [metric, setMetric] = useState<GoalMetric>(firstFree);
  const current = existing.find((e) => e.metric === metric);
  const [target, setTarget] = useState(() => String(current?.target ?? GOAL_SPEC[firstFree].suggested).replace(".", ","));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const selectRef = useRef<HTMLSelectElement>(null);
  const spec = GOAL_SPEC[metric];

  useEffect(() => selectRef.current?.focus(), []);

  function changeMetric(next: GoalMetric) {
    setMetric(next);
    const mine = existing.find((e) => e.metric === next);
    setTarget(String(mine?.target ?? GOAL_SPEC[next].suggested).replace(".", ","));
    setError(null);
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const check = goalInputSchema.safeParse({ metric, target });
    if (!check.success) {
      setError(check.error.issues[0]?.message ?? "Confira o valor.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await saveGoalAction({ metric, target });
      if (!result.ok) {
        if (result.field) setError(result.message);
        else toast.error("Não deu para salvar a meta", { description: result.message });
        return;
      }
      toast.success(result.message, { description: "O progresso aparece no seu painel durante a semana." });
      onDone();
      // From the empty state the trigger is gone after saving: keep keyboard focus in the panel.
      requestAnimationFrame(() => {
        if (document.activeElement === document.body) document.getElementById("goals-title")?.focus();
      });
    });
  }

  return (
    <form
      onSubmit={submit}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !pending) onDone();
      }}
      noValidate
      aria-busy={pending}
      aria-label="Nova meta"
      className="flex animate-enter flex-col gap-3 border-t border-line px-4 py-4 motion-reduce:animate-none"
    >
      <div className="grid gap-3 sm:max-w-xl sm:grid-cols-[minmax(0,1fr)_10rem]">
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor={`${id}-metric`} className="text-label text-fg-secondary">
            Métrica
          </label>
          <div className="relative">
            <select
              ref={selectRef}
              id={`${id}-metric`}
              value={metric}
              onChange={(e) => changeMetric(e.target.value as GoalMetric)}
              className="min-h-11 w-full cursor-pointer appearance-none rounded-control border border-line bg-surface-2 py-2.5 pr-9 pl-3 text-base text-fg transition-[border-color,box-shadow] duration-150 ease-out outline-none hover:border-line-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25 sm:min-h-10 sm:text-body-sm"
            >
              {GOAL_METRICS.map((m) => (
                <option key={m} value={m}>
                  {GOAL_SPEC[m].name}
                  {existing.some((e) => e.metric === m) ? " (já tem meta)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-fg-muted" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-target`} className="text-label text-fg-secondary">
            {metric === "matches" ? "Quantas na semana" : "Acima de"}
          </label>
          <div
            className={cn(
              "flex min-h-11 items-center rounded-control border border-line bg-surface-2 transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/25 hover:border-line-strong sm:min-h-10",
              error && "border-loss ring-3 ring-loss/20",
            )}
          >
            <input
              id={`${id}-target`}
              inputMode="decimal"
              autoComplete="off"
              value={target}
              onChange={(e) => {
                setTarget(e.target.value);
                if (error) setError(null);
              }}
              aria-invalid={error ? true : undefined}
              aria-describedby={`${id}-hint`}
              className="num min-w-0 flex-1 bg-transparent py-2.5 pl-3 text-base text-fg outline-none focus-visible:outline-none sm:text-body-sm"
            />
            {spec.unit ? (
              <span aria-hidden="true" className="pr-3 text-body-sm text-fg-muted">
                {spec.unit}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <p id={`${id}-hint`} role={error ? "alert" : undefined} className={cn("text-label font-normal", error ? "text-loss" : "text-fg-muted")}>
        {error ??
          (current
            ? `Você já tem essa meta (${formatTarget(metric, current.target)}). Salvar troca o alvo.`
            : `Entre ${formatTarget(metric, spec.min)} e ${formatTarget(metric, spec.max)}. Vale para as partidas competitivas da semana.`)}
      </p>
      <div className="flex flex-col-reverse gap-2 sm:flex-row">
        <Button type="button" variant="quiet" onClick={onDone} disabled={pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
          {pending ? "Salvando…" : "Salvar meta"}
        </Button>
      </div>
    </form>
  );
}
