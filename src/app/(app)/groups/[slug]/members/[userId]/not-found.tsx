import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

/**
 * Same answer whether the group, the member or the viewer's membership is
 * missing: a profile never reveals who is in a group to outsiders.
 */
export default function MemberNotFound() {
  return (
    <div className="py-16">
      <EmptyState
        icon={SearchX}
        title="Perfil não encontrado"
        description="Só quem está no mesmo grupo vê o perfil de um membro. Se você foi convidado, entre pelo link de convite."
        action={
          <Link href="/groups" className={buttonVariants()}>
            Ver meus grupos
          </Link>
        }
      />
    </div>
  );
}
