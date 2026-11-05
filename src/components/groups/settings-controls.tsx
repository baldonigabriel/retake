"use client";

import { LoaderCircle, RefreshCw, UserMinus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { removeMemberAction, revokeInviteAction, saveWebhookAction } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { webhookUrlSchema } from "@/lib/groups/validation";

export function RevokeInviteButton({ groupId }: { groupId: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="ghost" size="sm">
          <RefreshCw aria-hidden="true" />
          Gerar link novo
        </Button>
      }
      title="Gerar um link de convite novo?"
      description="O link atual para de funcionar na hora. Quem já está no grupo continua nele; quem ainda não entrou vai precisar do link novo."
      confirmLabel="Gerar link novo"
      pendingLabel="Gerando…"
      onConfirm={async () => {
        const result = await revokeInviteAction(groupId);
        if (!result.ok) {
          toast.error("Não deu para trocar o link", { description: result.message });
          return false;
        }
        toast.success("Link novo gerado", { description: "O link antigo não funciona mais." });
        router.refresh();
      }}
    />
  );
}

export function RemoveMemberButton({ groupId, userId, name }: { groupId: string; userId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="quiet" size="icon-sm" aria-label={`Remover ${name} do grupo`}>
          <UserMinus aria-hidden="true" />
        </Button>
      }
      title={`Remover ${name}?`}
      description="As partidas dessa pessoa saem do ranking do grupo. Ela só volta com o link de convite; troque o link se não quiser que isso aconteça."
      confirmLabel="Remover"
      pendingLabel="Removendo…"
      onConfirm={async () => {
        const result = await removeMemberAction(groupId, userId);
        if (!result.ok) {
          toast.error("Não deu para remover", { description: result.message });
          return false;
        }
        toast.success(`${name} saiu do grupo`);
        router.refresh();
      }}
    />
  );
}

/**
 * Discord webhook. The saved URL never comes back to the browser: the page
 * only gets a masked version. Saving replaces it; removing asks to confirm.
 */
export function WebhookForm({ groupId, masked, unreadable }: { groupId: string; masked: string | null; unreadable: boolean }) {
  const router = useRouter();
  const id = useId();
  const configured = masked !== null || unreadable;
  const [editing, setEditing] = useState(!configured);
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const check = webhookUrlSchema.safeParse(url);
  const error = serverError ?? (touched && url.length > 0 && !check.success ? check.error.issues[0]?.message : null);

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched(true);
    if (!check.success) {
      if (url.length === 0) setServerError("Cole a URL do webhook.");
      return;
    }
    startTransition(async () => {
      const result = await saveWebhookAction(groupId, url);
      if (!result.ok) {
        if (result.field === "url") setServerError(result.message);
        else toast.error("Não deu para salvar", { description: result.message });
        return;
      }
      toast.success("Webhook salvo", { description: "Guardado criptografado. Os cards de partida usam esse canal." });
      setUrl("");
      setTouched(false);
      setEditing(false);
      router.refresh();
    });
  }

  if (!editing) {
    return (
      <div className="flex flex-col gap-3">
        <div className="flex min-h-11 items-center gap-2 rounded-control bg-surface-2 px-3 py-2 shadow-hairline sm:min-h-10">
          <span className="size-2 shrink-0 rounded-full bg-win" aria-hidden="true" />
          <span className="truncate font-mono text-label text-fg-secondary">
            {unreadable ? "Webhook salvo, mas não conseguimos lê-lo" : masked}
          </span>
        </div>
        {unreadable ? (
          <p className="text-label font-normal text-fg-secondary">
            A chave de criptografia do servidor mudou. Cole a URL do webhook de novo para voltar a funcionar.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Trocar webhook
          </Button>
          <ConfirmDialog
            trigger={
              <Button type="button" variant="destructive" size="sm">
                Remover
              </Button>
            }
            title="Remover o webhook?"
            description="O grupo para de receber os cards de partida no Discord até você configurar um webhook de novo."
            confirmLabel="Remover webhook"
            pendingLabel="Removendo…"
            onConfirm={async () => {
              const result = await saveWebhookAction(groupId, null);
              if (!result.ok) {
                toast.error("Não deu para remover", { description: result.message });
                return false;
              }
              toast.success("Webhook removido");
              setEditing(true);
              router.refresh();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={save} noValidate className="flex flex-col gap-3" aria-busy={pending}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-url`} className="text-label text-fg-secondary">
          URL do webhook
        </label>
        <Input
          id={`${id}-url`}
          name="webhook"
          type="url"
          inputMode="url"
          autoComplete="off"
          spellCheck={false}
          placeholder="https://discord.com/api/webhooks/…"
          value={url}
          className="font-mono"
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`}
          onChange={(e) => {
            setUrl(e.target.value);
            setServerError(null);
          }}
          onBlur={() => setTouched(true)}
        />
        {error ? (
          <p id={`${id}-error`} className="text-label font-normal text-loss">
            {error}
          </p>
        ) : null}
        <p id={`${id}-hint`} className="text-label font-normal text-fg-muted">
          No Discord: Editar canal › Integrações › Webhooks › Novo webhook › Copiar URL do webhook.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="secondary" size="sm" disabled={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
          {pending ? "Salvando…" : "Salvar webhook"}
        </Button>
        {configured ? (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            disabled={pending}
            onClick={() => {
              setEditing(false);
              setUrl("");
              setServerError(null);
            }}
          >
            Cancelar
          </Button>
        ) : null}
      </div>
    </form>
  );
}
