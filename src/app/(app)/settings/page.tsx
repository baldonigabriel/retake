import type { Metadata } from "next";

import { Avatar } from "@/components/layout/account-menu";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Badge } from "@/components/ui/badge";
import { requireViewer } from "@/lib/auth/session";
import { formatMatchDate, formatRelativeTime } from "@/lib/format";

export const metadata: Metadata = { title: "Ajustes" };

const STATUS = {
  ok: { label: "Em dia", variant: "win" },
  pending: { label: "Aguardando", variant: "default" },
  error: { label: "Falhou", variant: "loss" },
} as const;

export default async function SettingsPage() {
  const { user, account } = await requireViewer("/settings");
  const now = new Date();
  const status = STATUS[account.syncStatus];

  return (
    <div className="flex max-w-2xl flex-col gap-4 py-8 sm:py-10">
      <h1 className="text-heading text-fg">Ajustes</h1>

      <section aria-labelledby="riot-title" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
        <h2 id="riot-title" className="text-body-sm font-semibold text-fg">Conta Riot vinculada</h2>
        <div className="flex items-center gap-3">
          <span className="size-12 shrink-0 overflow-hidden rounded-control bg-surface-3">
            {account.cardUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- community player card asset
              <img src={account.cardUrl} alt="" width={48} height={48} className="size-full object-cover" />
            ) : null}
          </span>
          <p className="flex min-w-0 items-baseline gap-1 font-medium text-fg">
            <span className="truncate">{account.gameName}</span>
            <span className="font-mono text-label text-fg-muted">#{account.tagLine}</span>
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-body-sm">
          <dt className="text-fg-secondary">Último sync</dt>
          <dd className="num text-fg">
            {account.lastSyncedAt ? (
              <time dateTime={account.lastSyncedAt.toISOString()} title={formatMatchDate(account.lastSyncedAt)}>
                {formatRelativeTime(account.lastSyncedAt, now)}
              </time>
            ) : (
              "Ainda não sincronizado"
            )}
          </dd>
          <dt className="text-fg-secondary">Status</dt>
          <dd>
            <Badge variant={status.variant}>{status.label}</Badge>
          </dd>
        </dl>
        <p className="text-label font-normal text-fg-muted">
          Sincronizamos sozinhos a cada 15 minutos, mais ou menos. A opção de desvincular a conta (apagando seus dados)
          chega na próxima atualização.
        </p>
      </section>

      <section aria-labelledby="discord-title" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} image={user.image} className="size-10" />
          <div className="flex flex-col">
            <h2 id="discord-title" className="text-body-sm font-semibold text-fg">Discord</h2>
            <p className="text-fg-secondary">Conectado como {user.name}</p>
          </div>
        </div>
        <SignOutButton />
      </section>
    </div>
  );
}
