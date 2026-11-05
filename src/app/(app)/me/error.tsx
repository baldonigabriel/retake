"use client";

import { CloudOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function MeError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16">
      <ErrorState
        icon={CloudOff}
        title="Não conseguimos carregar seu painel"
        description="Algo falhou ao montar seu painel. Verifique sua conexão e tente de novo; suas partidas continuam salvas."
        action={
          <Button type="button" onClick={() => retry()}>
            Tentar de novo
          </Button>
        }
      />
    </div>
  );
}
