import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LoginAccounts } from "@/components/auth/login-accounts";
import type { SocialProvider } from "@/components/auth/social-auth-buttons";
import { Avatar } from "@/components/layout/account-menu";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ProfileChoice } from "@/components/profile/profile-choice";
import { BreakReminderSwitch } from "@/components/session/break-reminder-switch";
import { Badge } from "@/components/ui/badge";
import { db } from "@/db";
import { listLoginAccounts } from "@/lib/auth/accounts";
import { requireViewer } from "@/lib/auth/session";
import { formatMatchDate, formatRelativeTime } from "@/lib/format";
import { getBreakReminder } from "@/lib/preferences/queries";
import { profilePath } from "@/lib/profile/path";
import { getProfileSettings } from "@/lib/profile/queries";
import { choiceFromSettings, isProfileVisible } from "@/lib/profile/settings";
import { TILT_STREAK } from "@/lib/stats/session";

export const metadata: Metadata = { title: "Ajustes" };

const STATUS = {
  ok: { label: "Em dia", variant: "win" },
  pending: { label: "Aguardando", variant: "default" },
  error: { label: "Falhou", variant: "loss" },
} as const;

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { user, account } = await requireViewer("/settings");
  const params = await searchParams;
  const [breakReminder, loginAccounts, profile] = await Promise.all([
    getBreakReminder(user.id),
    listLoginAccounts(db(), user.id),
    getProfileSettings(user.id),
  ]);
  const profileVisible = isProfileVisible(profile);
  const now = new Date();
  const status = STATUS[account.syncStatus];
  const linked = socialProvider(params.linked);
  const linkError = socialProvider(params.linkError);

  return (
    <div className="content-enter flex max-w-2xl flex-col gap-4 py-8 sm:py-10">
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

      <section
        id="break-reminder"
        aria-labelledby="break-title"
        className="flex scroll-mt-24 items-start justify-between gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:items-center sm:p-5"
      >
        <div className="flex min-w-0 flex-col gap-1">
          <h2 id="break-title" className="text-body-sm font-semibold text-fg">
            Aviso de pausa
          </h2>
          <p id="break-desc" className="text-fg-secondary">
            Depois de {TILT_STREAK} derrotas seguidas na mesma sessão, o painel sugere uma pausa curta. Ninguém além de você vê.
          </p>
        </div>
        <BreakReminderSwitch on={breakReminder} labelledBy="break-title" describedBy="break-desc" />
      </section>

      <section
        id="perfil"
        aria-labelledby="profile-title"
        className="flex scroll-mt-24 flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="profile-title" className="flex items-center gap-2 text-body-sm font-semibold text-fg">
              Perfil público
              <Badge variant={profileVisible ? "accent" : "default"}>{profileVisible ? "Público" : "Privado"}</Badge>
            </h2>
            <p className="text-fg-secondary">
              {profileVisible
                ? "Qualquer pessoa vê as seções marcadas pelo link ou pela busca. Grupos, Bagre e duplas nunca aparecem."
                : "Ninguém fora dos seus grupos vê seus números, e seu nome não aparece na busca."}
            </p>
          </div>
          {profileVisible ? (
            <Link
              href={profilePath(account)}
              className="hover-layer press relative inline-flex min-h-11 shrink-0 items-center gap-1.5 self-start rounded-control px-2 text-body-sm text-fg-secondary hover:text-fg sm:min-h-8"
            >
              Ver como visitante
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </Link>
          ) : null}
        </div>
        <ProfileChoice initial={choiceFromSettings(profile)} riotId={account} />
      </section>

      <LoginAccounts accounts={loginAccounts} linked={linked} linkError={linkError} />

      <section aria-labelledby="session-title" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <Avatar name={account.gameName} image={user.image} className="size-10" />
          <div className="flex flex-col">
            <h2 id="session-title" className="text-body-sm font-semibold text-fg">Sessão atual</h2>
            <p className="text-fg-secondary">
              Conectado como {account.gameName}<span className="font-mono text-label text-fg-muted">#{account.tagLine}</span>
            </p>
          </div>
        </div>
        <SignOutButton />
      </section>
    </div>
  );
}

function socialProvider(value: string | string[] | undefined): SocialProvider | undefined {
  const provider = Array.isArray(value) ? value[0] : value;
  return provider === "google" || provider === "discord" ? provider : undefined;
}
