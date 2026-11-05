"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import { joinGroupAction } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";

export function JoinGroupButton({ code, groupName }: { code: string; groupName: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      className="w-full sm:w-fit"
      disabled={pending}
      aria-busy={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await joinGroupAction(code);
          if (!result.ok) {
            toast.error("Não deu para entrar", { description: result.message });
            router.refresh();
            return;
          }
          toast.success(`Você entrou em “${groupName}”`);
          router.replace(`/groups/${result.slug}`);
        })
      }
    >
      {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
      {pending ? "Entrando…" : "Entrar no grupo"}
    </Button>
  );
}
