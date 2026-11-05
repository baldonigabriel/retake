import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { requireViewer } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Grupos" };

/** Groups ship in Phase 3; until then the nav item explains what's coming. */
export default async function GroupsPage() {
  await requireViewer("/groups");
  return (
    <div className="flex flex-col gap-4 py-8 sm:py-10">
      <h1 className="text-heading text-fg">Grupos</h1>
      <section className="rounded-card bg-surface-1 shadow-hairline">
        <EmptyState
          icon={Users}
          title="Grupos estão chegando"
          description="Em breve você cria um grupo, convida os amigos por link e vê o ranking da semana e as partidas que jogaram juntos."
          action={
            <Link href="/me" className={buttonVariants()}>
              Voltar ao painel
            </Link>
          }
        />
      </section>
    </div>
  );
}
