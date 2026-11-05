"use client";

import { CloudOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function MatchError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16">
      <ErrorState
        icon={CloudOff}
        title="Não conseguimos abrir esta partida"
        description="Algo falhou ao carregar o placar. Verifique sua conexão e tente de novo."
        action={
          <Button type="button" onClick={() => retry()}>
            Tentar de novo
          </Button>
        }
      />
    </div>
  );
}
