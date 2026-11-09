import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

/**
 * One answer for a private profile, a player who doesn't use the Retake and
 * a name that doesn't exist (SPEC §6.1): nothing here tells them apart.
 */
export default function PublicProfileNotFound() {
  return (
    <div className="py-16">
      <EmptyState
        icon={SearchX}
        title="Perfil não encontrado"
        description="Não há perfil público com esse Riot ID. Confira o nome e a tag, ou procure pela busca."
        action={
          <Link href="/search" className={buttonVariants()}>
            Buscar perfis
          </Link>
        }
      />
    </div>
  );
}
