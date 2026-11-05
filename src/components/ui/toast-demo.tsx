"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";

export function ToastDemo() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant="ghost"
        onClick={() =>
          toast.success("Sincronização concluída", {
            description: "3 partidas novas importadas.",
          })
        }
      >
        Mostrar toast de sucesso
      </Button>
      <Button
        variant="ghost"
        onClick={() =>
          toast.error("Não deu para sincronizar", {
            description: "A API está ocupada. Tentamos de novo em 2 min.",
          })
        }
      >
        Mostrar toast de erro
      </Button>
    </div>
  );
}
