import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

export default function MatchNotFound() {
  return (
    <div className="py-16">
      <EmptyState
        icon={SearchX}
        title="Partida não encontrada"
        description="Ela não está nas suas partidas importadas. Se você acabou de jogar, espere o próximo sync ou sincronize pelo painel."
        action={
          <Link href="/me" className={buttonVariants()}>
            Voltar ao painel
          </Link>
        }
      />
    </div>
  );
}
