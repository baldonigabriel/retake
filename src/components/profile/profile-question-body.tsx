"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { postponeProfileQuestionAction } from "@/app/(app)/settings/actions";
import { ProfileChoice } from "@/components/profile/profile-choice";
import { Button } from "@/components/ui/button";

/** The /me card's controls: the shared choice plus "Agora não". */
export function ProfileQuestionBody({ riotId }: { riotId: { gameName: string; tagLine: string } }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function later() {
    startTransition(async () => {
      const result = await postponeProfileQuestionAction();
      if (!result.ok) {
        toast.error("Não deu para adiar", { description: result.message });
        return;
      }
      router.refresh();
    });
  }

  return (
    <ProfileChoice
      initial={null}
      riotId={riotId}
      compact
      onSaved={({ visible }) => {
        toast.success(visible ? "Perfil público" : "Perfil privado", {
          description: "Dá para mudar quando quiser em Ajustes.",
        });
        router.refresh();
      }}
      secondaryAction={
        <Button type="button" variant="ghost" onClick={later} disabled={pending} className="w-full sm:w-fit">
          Agora não
        </Button>
      }
    />
  );
}
