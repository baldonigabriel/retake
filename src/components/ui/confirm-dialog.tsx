"use client";

import { LoaderCircle } from "lucide-react";
import { AlertDialog } from "radix-ui";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Confirmation for destructive actions (DESIGN.md › Botão destrutivo: always
 * confirm). A modal: opens centred with fade + scale from 0.95 (200ms, strong
 * ease-out) and closes faster (120ms). Focus starts on "Cancelar", the safe
 * choice. `onConfirm` returns false to keep the dialog open (e.g. on error).
 */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  onConfirm,
}: {
  trigger: React.ReactNode;
  title: string;
  description: string;
  confirmLabel: string;
  pendingLabel: string;
  onConfirm: () => Promise<boolean | void>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <AlertDialog.Root open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <AlertDialog.Trigger asChild>{trigger}</AlertDialog.Trigger>
      <AlertDialog.Portal>
        <AlertDialog.Overlay
          className={cn(
            "reduce-fade fixed inset-0 z-50 bg-surface-0/70 backdrop-blur-[2px]",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-120",
          )}
        />
        <AlertDialog.Content
          className={cn(
            "reduce-fade fixed top-1/2 left-1/2 z-50 flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-card-lg border border-line-strong bg-surface-3 p-5 shadow-pop",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-200 data-[state=open]:ease-(--ease-out)",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-120 data-[state=closed]:ease-out",
            "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100",
          )}
        >
          <div className="flex flex-col gap-1.5">
            <AlertDialog.Title className="text-body font-semibold text-fg">{title}</AlertDialog.Title>
            <AlertDialog.Description className="text-body-sm text-fg-secondary">{description}</AlertDialog.Description>
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Cancelar
              </Button>
            </AlertDialog.Cancel>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              aria-busy={pending}
              onClick={() =>
                startTransition(async () => {
                  const keepOpen = (await onConfirm()) === false;
                  if (!keepOpen) setOpen(false);
                })
              }
            >
              {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
              {pending ? pendingLabel : confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
