import { SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";

/**
 * Same answer for "doesn't exist" and "you're not a member", so a group's
 * existence never leaks to outsiders.
 */
export default function GroupNotFound() {
  return (
    <div className="py-16">
      <EmptyState
        icon={SearchX}
        title="Grupo não encontrado"
        description="Ele não existe ou você não faz parte dele. Para entrar, peça o link de convite a alguém do grupo."
        action={
          <Link href="/groups" className={buttonVariants()}>
            Ver meus grupos
          </Link>
        }
      />
    </div>
  );
}
