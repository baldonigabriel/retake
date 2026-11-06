"use client";

import { CloudOff } from "lucide-react";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

export default function BagreError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="py-16">
      <ErrorState
        icon={CloudOff}
        title="Não conseguimos carregar o Bagre"
        description="Algo falhou ao buscar as indicações. Verifique sua conexão e tente de novo; nenhuma indicação ou voto foi perdido."
        action={
          <Button type="button" onClick={() => retry()}>
            Tentar de novo
          </Button>
        }
      />
    </div>
  );
}
