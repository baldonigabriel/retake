import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function AgentNotFound() {
  return (
    <div className="py-16">
      <EmptyState
        icon={SearchX}
        title="Você ainda não jogou com esse agente"
        description="Esta página aparece depois da primeira partida com ele nas suas partidas importadas."
        action={
          <Link href="/me" className={buttonVariants()}>
            Ver seus agentes
          </Link>
        }
      />
    </div>
  );
}
