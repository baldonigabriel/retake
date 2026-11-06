"use client";

import { RotateCw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { deleteGoalAction } from "@/app/(app)/me/goal-actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/** Removing a goal is destructive, so it asks first (DESIGN.md › Botão destrutivo). */
export function DeleteGoalButton({ goalId, label }: { goalId: string; label: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="quiet" size="icon-sm" aria-label={`Remover meta: ${label}`} title="Remover meta">
          <Trash2 aria-hidden="true" />
        </Button>
      }
      title="Remover esta meta?"
      description={`“${label}” sai do seu painel. Suas partidas não mudam e você pode criar a meta de novo quando quiser.`}
      confirmLabel="Remover meta"
      pendingLabel="Removendo…"
      onConfirm={async () => {
        const result = await deleteGoalAction(goalId);
        if (!result.ok) {
          toast.error("Não deu para remover", { description: result.message });
          return false;
        }
        toast.success(result.message);
      }}
    />
  );
}

/** Error state action: reloads the server data for this page. */
export function RetryButton({ label = "Tentar de novo" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      <RotateCw aria-hidden="true" className={pending ? "animate-spin" : undefined} />
      {label}
    </Button>
  );
}
