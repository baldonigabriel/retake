"use client";

import { Check, Copy, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { leaveGroupAction } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export function inviteUrl(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}

/**
 * Copies the invite link. The icon swaps Copy → Check for 2s (opacity + a
 * small scale, 150ms ease-out) so the state change is visible without a toast
 * for repeated copies; the first copy also toasts for screen readers.
 */
export function CopyInviteButton({
  code,
  variant = "ghost",
  size = "sm",
  label = "Copiar convite",
  className,
}: {
  code: string;
  variant?: "ghost" | "default";
  size?: "sm" | "default";
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl(code));
      setCopied(true);
      toast.success("Link de convite copiado", { description: "Quem abrir o link entra no grupo depois de logar." });
    } catch {
      toast.error("Não deu para copiar", { description: "Seu navegador bloqueou a área de transferência. Copie o link em Ajustes do grupo." });
    }
  }

  return (
    <Button type="button" variant={variant} size={size} onClick={copy} className={className} data-copied={copied || undefined}>
      <span className="relative inline-flex size-4" aria-hidden="true">
        <Copy
          className={cn(
            "absolute inset-0 transition-[opacity,scale] duration-150 ease-(--ease-out) motion-reduce:transition-opacity",
            copied ? "scale-75 opacity-0" : "scale-100 opacity-100",
          )}
        />
        <Check
          className={cn(
            "absolute inset-0 transition-[opacity,scale] duration-150 ease-(--ease-out) motion-reduce:transition-opacity",
            copied ? "scale-100 opacity-100" : "scale-75 opacity-0",
          )}
        />
      </span>
      {copied ? "Copiado" : label}
    </Button>
  );
}

export function LeaveGroupButton({
  groupId,
  groupName,
  role,
  alone,
  className,
}: {
  groupId: string;
  groupName: string;
  role: "owner" | "member";
  alone: boolean;
  className?: string;
}) {
  const router = useRouter();
  const description = alone
    ? `Você é o único membro: ao sair, o grupo “${groupName}” é apagado junto com o link de convite.`
    : role === "owner"
      ? "O membro mais antigo vira dono do grupo. Para voltar, você vai precisar de um convite novo."
      : "Suas partidas deixam de contar no ranking do grupo. Para voltar, você vai precisar de um convite.";

  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="destructive" size="sm" className={className}>
          <LogOut aria-hidden="true" />
          {alone ? "Sair e apagar grupo" : "Sair do grupo"}
        </Button>
      }
      title={alone ? `Apagar “${groupName}”?` : `Sair de “${groupName}”?`}
      description={description}
      confirmLabel={alone ? "Sair e apagar" : "Sair do grupo"}
      pendingLabel="Saindo…"
      onConfirm={async () => {
        const result = await leaveGroupAction(groupId);
        // On success the action redirects to /groups.
        if (result && !result.ok) {
          toast.error("Não deu para sair", { description: result.message });
          router.refresh();
          return false;
        }
      }}
    />
  );
}
