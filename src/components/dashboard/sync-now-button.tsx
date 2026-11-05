"use client";

import { LoaderCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { syncNowAction } from "@/app/(app)/me/actions";
import { Button } from "@/components/ui/button";

/**
 * Ghost button (the screen's primary red stays free for empty-state actions).
 * Disabled during the 2-minute cooldown, re-enabled on its own.
 */
export function SyncNowButton({
  cooldownUntil,
  variant = "ghost",
}: {
  cooldownUntil: number | null;
  variant?: "ghost" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [blockedUntil, setBlockedUntil] = useState(cooldownUntil);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!blockedUntil) return;
    const left = blockedUntil - Date.now();
    if (left <= 0) return;
    const timer = setTimeout(() => forceTick((n) => n + 1), left + 50);
    return () => clearTimeout(timer);
  }, [blockedUntil]);

  // eslint-disable-next-line react-hooks/purity -- re-evaluated by the timer above
  const coolingDown = blockedUntil !== null && blockedUntil > Date.now();

  function sync() {
    startTransition(async () => {
      const result = await syncNowAction();
      if (!result.ok) {
        if (result.retryAt) setBlockedUntil(result.retryAt);
        else router.refresh(); // shows the sync error notice
        toast.error("Não deu para sincronizar", { description: result.message });
        return;
      }
      setBlockedUntil(Date.now() + 2 * 60_000);
      toast.success(
        result.inserted > 0
          ? `${result.inserted} ${result.inserted === 1 ? "partida nova" : "partidas novas"}`
          : "Tudo em dia",
        { description: result.inserted > 0 ? "Seu painel já está atualizado." : "Nenhuma partida nova desde o último sync." },
      );
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={variant === "ghost" ? "sm" : "default"}
      onClick={sync}
      disabled={pending || coolingDown}
      aria-busy={pending}
      title={coolingDown ? "Disponível de novo em até 2 minutos" : undefined}
      className={variant === "default" ? "w-full sm:w-fit" : undefined}
    >
      {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <RefreshCw aria-hidden="true" />}
      {pending ? "Sincronizando…" : "Sincronizar agora"}
    </Button>
  );
}
