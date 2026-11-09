"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { deleteAccountAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * "Apagar minha conta" (DESIGN.md › Botão destrutivo: always confirmed).
 * The dialog says what happens to each group the user owns.
 */
export function DeleteAccount({ groupNotes }: { groupNotes: readonly string[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const description = [
    "Apagamos seu login, o vínculo com o Riot ID, o histórico de rank, metas, preferências, perfil público, indicações e votos. Não dá para desfazer.",
    ...groupNotes,
    "As partidas continuam no placar de quem jogou com você.",
  ].join(" ");

  return (
    <div className="flex flex-col gap-2">
      <ConfirmDialog
        trigger={
          <Button type="button" variant="destructive" className="w-full sm:w-fit">
            <Trash2 aria-hidden="true" />
            Apagar minha conta
          </Button>
        }
        title="Apagar sua conta do Retake?"
        description={description}
        confirmLabel="Apagar minha conta"
        pendingLabel="Apagando…"
        onConfirm={async () => {
          setError(null);
          const result = await deleteAccountAction();
          if (!result.ok) {
            setError(result.message);
            toast.error("A conta não foi apagada", { description: result.message });
            return false;
          }
          toast.success("Conta apagada", { description: "Seus dados foram removidos do Retake." });
          router.replace("/");
          router.refresh();
        }}
      />
      {error ? (
        <p role="alert" className="text-label font-normal text-fg">
          {error}
        </p>
      ) : null}
    </div>
  );
}
