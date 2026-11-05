"use client";

import { CloudOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

/** Also covers /groups/[slug] and its settings (nearest error boundary). */
export default function GroupsError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16">
      <ErrorState
        icon={CloudOff}
        title="Não conseguimos carregar os grupos"
        description="Algo falhou ao buscar os dados do grupo. Verifique sua conexão e tente de novo; nada do seu grupo foi perdido."
        action={
          <Button type="button" onClick={() => retry()}>
            Tentar de novo
          </Button>
        }
      />
    </div>
  );
}
