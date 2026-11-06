import { ChevronRight, Link2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { StaggerList } from "@/components/dashboard/stagger-list";
import { CreateGroupForm } from "@/components/groups/create-group-form";
import { Badge } from "@/components/ui/badge";
import { requireViewer } from "@/lib/auth/session";
import { listGroupsForUser } from "@/lib/groups/queries";

export const metadata: Metadata = {
  title: "Grupos",
  description: "Seus grupos de amigos: ranking da semana, MVP e partidas que jogaram juntos.",
};

export default async function GroupsPage() {
  const { user } = await requireViewer("/groups");
  const groups = await listGroupsForUser(user.id);
  const empty = groups.length === 0;

  return (
    <div className="flex flex-col gap-4 py-8 sm:py-10">
      <header className="flex flex-col gap-2">
        <h1 className="text-heading text-fg">Grupos</h1>
        <p className="max-w-[70ch] text-fg-secondary">
          Quem mandou bem essa semana? Cada grupo tem ranking semanal, MVP e as partidas que vocês jogaram juntos.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-12 lg:items-start">
        <section
          aria-labelledby="my-groups-title"
          className="overflow-hidden rounded-card bg-surface-1 shadow-hairline lg:col-span-7"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <h2 id="my-groups-title" className="text-body-sm font-semibold text-fg">
              Seus grupos
            </h2>
            {!empty ? <span className="num text-label font-normal text-fg-muted">{groups.length}</span> : null}
          </header>
          {empty ? (
            <div className="flex flex-col items-center gap-3 px-4 py-10 text-center">
              <Users aria-hidden="true" className="size-8 text-fg-muted" strokeWidth={1.5} />
              <div className="flex max-w-sm flex-col gap-1">
                <p className="font-medium text-fg">Você ainda não está em nenhum grupo</p>
                <p className="text-fg-secondary">
                  Crie um grupo ao lado e mande o link para os amigos. Recebeu um convite? É só abrir o link.
                </p>
              </div>
            </div>
          ) : (
            <StaggerList aria-label="Seus grupos" className="divide-y divide-line">
              {groups.map((g, i) => (
                <li key={g.id} style={{ "--i": i } as React.CSSProperties}>
                  <Link
                    href={`/groups/${g.slug}`}
                    className="group relative hover-layer press [--press-scale:0.99] focus-visible:outline-offset-[-2px] flex min-h-16 items-center gap-3 px-4 py-3"
                  >
                    <span
                      aria-hidden="true"
                      className="stat inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-3 text-[18px] font-semibold text-fg-secondary uppercase"
                    >
                      {g.name.slice(0, 1)}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium text-fg">{g.name}</span>
                        {g.role === "owner" ? <Badge variant="outline">dono</Badge> : null}
                      </span>
                      <span className="num truncate text-label font-normal text-fg-muted">
                        {g.members} {g.members === 1 ? "membro" : "membros"}
                        <span className="font-mono"> · /groups/{g.slug}</span>
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 text-fg-muted transition-[translate] duration-150 ease-(--ease-out) group-hover:translate-x-0.5 group-hover:text-fg-secondary group-focus-visible:text-fg-secondary motion-reduce:transition-none"
                    />
                  </Link>
                </li>
              ))}
            </StaggerList>
          )}
        </section>

        <section
          aria-labelledby="create-group-title"
          className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5 lg:col-span-5"
        >
          <div className="flex flex-col gap-1">
            <h2 id="create-group-title" className="text-body-sm font-semibold text-fg">
              Criar grupo
            </h2>
            <p className="text-fg-secondary">Você vira dono e recebe um link de convite para mandar aos amigos.</p>
          </div>
          <CreateGroupForm />
          <p className="flex gap-2 border-t border-line pt-4 text-label font-normal text-fg-muted">
            <Link2 aria-hidden="true" className="mt-px size-3.5 shrink-0" />
            Grupos são só por convite: ninguém encontra o seu grupo por busca.
          </p>
        </section>
      </div>
    </div>
  );
}
