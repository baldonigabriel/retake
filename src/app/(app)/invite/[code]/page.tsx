import { Link2Off, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { JoinGroupButton } from "@/components/groups/join-group-button";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { requireViewer } from "@/lib/auth/session";
import { getInvite, getRole } from "@/lib/groups/queries";

export const metadata: Metadata = {
  title: "Convite para grupo",
  // Invite links are private: never index them.
  robots: { index: false, follow: false },
};

/**
 * The invite token is the only thing that reveals a group to a non-member,
 * and only its name and size. Signed-out visitors go to login and come back
 * here; users without a Riot ID go through onboarding and come back too.
 */
export default async function InvitePage({ params }: PageProps<"/invite/[code]">) {
  const { code } = await params;
  const { user } = await requireViewer(`/invite/${encodeURIComponent(code)}`);
  const invite = await getInvite(code);

  if (!invite) {
    return (
      <div className="mx-auto w-full max-w-md py-16">
        <section className="rounded-card bg-surface-1 shadow-hairline">
          <EmptyState
            icon={Link2Off}
            title="Esse convite não vale mais"
            description="O link pode ter sido trocado por quem criou o grupo. Peça um link novo e abra de novo."
            action={
              <Link href="/groups" className={buttonVariants()}>
                Ver meus grupos
              </Link>
            }
          />
        </section>
      </div>
    );
  }

  if ((await getRole(invite.id, user.id)) !== null) redirect(`/groups/${invite.slug}`);

  return (
    <div className="mx-auto flex w-full max-w-md flex-col py-12 sm:py-16">
      <section
        aria-labelledby="invite-title"
        className="flex flex-col gap-5 rounded-card-lg bg-surface-1 p-5 shadow-key sm:p-6"
      >
        <div className="flex flex-col gap-3">
          <p className="text-eyebrow text-fg-muted uppercase">Convite para grupo</p>
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="stat inline-flex size-12 shrink-0 items-center justify-center rounded-card bg-surface-3 text-[24px] font-semibold text-fg uppercase"
            >
              {invite.name.slice(0, 1)}
            </span>
            <div className="flex min-w-0 flex-col">
              <h1 id="invite-title" className="truncate text-subheading text-fg">
                {invite.name}
              </h1>
              <p className="num flex items-center gap-1.5 text-label font-normal text-fg-muted">
                <Users aria-hidden="true" className="size-3.5" />
                {invite.members} {invite.members === 1 ? "membro" : "membros"}
              </p>
            </div>
          </div>
        </div>
        <p className="text-fg-secondary">
          Ao entrar, suas partidas passam a contar no ranking semanal do grupo e os membros veem suas estatísticas e as
          partidas que vocês jogarem juntos. Você pode sair quando quiser.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
          <JoinGroupButton code={code} groupName={invite.name} />
          <Link href="/groups" className={buttonVariants({ variant: "quiet", className: "w-full sm:w-fit" })}>
            Agora não
          </Link>
        </div>
      </section>
    </div>
  );
}
