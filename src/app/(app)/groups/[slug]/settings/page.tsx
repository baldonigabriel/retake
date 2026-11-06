import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { Avatar } from "@/components/layout/account-menu";
import { CopyInviteButton, LeaveGroupButton } from "@/components/groups/group-buttons";
import { RemoveMemberButton, RevokeInviteButton, WebhookForm } from "@/components/groups/settings-controls";
import { Badge } from "@/components/ui/badge";
import { serverEnv } from "@/env";
import { requireViewer } from "@/lib/auth/session";
import { decrypt, serverKey } from "@/lib/crypto";
import { webhookContext } from "@/lib/groups/mutations";
import { getGroupMembers, getMembership } from "@/lib/groups/queries";
import { MAX_MEMBERS, maskWebhook } from "@/lib/groups/validation";

export const metadata: Metadata = {
  title: "Ajustes do grupo",
  robots: { index: false, follow: false },
};

function webhookView(groupId: string, stored: string | null): { masked: string | null; unreadable: boolean } {
  if (!stored) return { masked: null, unreadable: false };
  try {
    return { masked: maskWebhook(decrypt(stored, serverKey(), webhookContext(groupId))), unreadable: false };
  } catch (error) {
    console.error("[groups] stored webhook can't be decrypted", groupId, error);
    return { masked: null, unreadable: true };
  }
}

/** Owner only. Members are sent back to the group; outsiders get 404. */
export default async function GroupSettingsPage({ params }: PageProps<"/groups/[slug]/settings">) {
  const { slug } = await params;
  const { user } = await requireViewer(`/groups/${slug}/settings`);
  const membership = await getMembership(slug, user.id);
  if (!membership) notFound();
  if (membership.role !== "owner") redirect(`/groups/${slug}`);
  const { group } = membership;

  const members = await getGroupMembers(group.id, user.id);
  const webhook = webhookView(group.id, group.discordWebhookUrl);
  const base = serverEnv().BETTER_AUTH_URL ?? "";
  const inviteLink = `${base}/invite/${group.inviteCode}`;

  return (
    <div className="flex max-w-2xl flex-col gap-4 py-6 sm:py-8">
      <Link
        href={`/groups/${group.slug}`}
        className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-control px-2 text-body-sm text-fg-secondary transition-colors duration-150 ease-out hover:text-fg sm:min-h-8"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {group.name}
      </Link>
      <h1 className="text-heading text-fg">Ajustes do grupo</h1>

      <section aria-labelledby="invite-title" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 id="invite-title" className="text-body-sm font-semibold text-fg">
            Link de convite
          </h2>
          <p className="text-fg-secondary">
            Quem abrir o link entra no grupo depois de logar com o Discord e vincular o Riot ID. Não tem outra forma de entrar.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label htmlFor="invite-link" className="sr-only">
            Link de convite
          </label>
          <input
            id="invite-link"
            readOnly
            value={inviteLink}
            className="min-h-11 w-full min-w-0 truncate rounded-control border border-line bg-surface-2 px-3 font-mono text-label text-fg-secondary outline-none focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25 sm:min-h-10"
          />
          <CopyInviteButton code={group.inviteCode} variant="default" size="default" label="Copiar link" className="w-full sm:w-fit" />
        </div>
        <div className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-label font-normal text-fg-muted">O link vazou? Gere outro: o atual para de funcionar na hora.</p>
          <RevokeInviteButton groupId={group.id} />
        </div>
      </section>

      <section aria-labelledby="discord-title" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 id="discord-title" className="flex items-center gap-2 text-body-sm font-semibold text-fg">
            Discord
            <span className="sr-only">,</span>
            <Badge>em breve</Badge>
          </h2>
          <p className="text-fg-secondary">
            Depois de cada partida, um card com quem do grupo jogou vai para o canal desse webhook. O envio começa na próxima
            atualização do Retake; você já pode deixar o canal pronto.
          </p>
        </div>
        <WebhookForm groupId={group.id} masked={webhook.masked} unreadable={webhook.unreadable} />
        <p className="text-label font-normal text-fg-muted">
          A URL fica guardada criptografada e só aparece mascarada aqui. Quem tem a URL consegue postar no canal, então não
          compartilhe.
        </p>
      </section>

      <section aria-labelledby="members-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 id="members-title" className="text-body-sm font-semibold text-fg">
            Membros
          </h2>
          <span className="num text-label font-normal text-fg-muted">{members.length} de {MAX_MEMBERS}</span>
        </header>
        <ul className="divide-y divide-line">
          {members.map((m) => (
            <li key={m.userId} className="flex min-h-14 items-center gap-3 px-4 py-2 sm:px-5">
              <Avatar name={m.name} image={m.image} />
              <span className="flex min-w-0 flex-1 items-baseline gap-1">
                <span className="truncate text-fg">{m.name}</span>
                {m.tag ? (
                  <span className="font-mono text-label text-fg-muted">#{m.tag}</span>
                ) : (
                  <span className="text-label font-normal text-fg-muted">sem Riot ID</span>
                )}
              </span>
              {m.isYou ? <Badge variant="outline">você</Badge> : null}
              {m.role === "owner" ? (
                <Badge>dono</Badge>
              ) : (
                <RemoveMemberButton groupId={group.id} userId={m.userId} name={m.name} />
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="leave-title" className="flex flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex flex-col gap-1">
          <h2 id="leave-title" className="text-body-sm font-semibold text-fg">
            Sair do grupo
          </h2>
          <p className="text-fg-secondary">
            {members.length > 1
              ? "O membro mais antigo vira o dono. Se você for o último, o grupo é apagado."
              : "Você é o único membro, então sair apaga o grupo."}
          </p>
        </div>
        <LeaveGroupButton groupId={group.id} groupName={group.name} role="owner" alone={members.length === 1} className="w-full shrink-0 sm:w-fit" />
      </section>
    </div>
  );
}
