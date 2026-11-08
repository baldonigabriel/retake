"use client";

import { Check, Link2, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { unlinkLoginAccountAction } from "@/app/(app)/settings/actions";
import { SocialAuthButtons, type SocialProvider } from "@/components/auth/social-auth-buttons";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { LoginAccount } from "@/lib/auth/accounts";

const LABELS: Record<SocialProvider, string> = { google: "Google", discord: "Discord" };
const PROVIDERS: readonly SocialProvider[] = ["google", "discord"];

export function LoginAccounts({
  accounts,
  linked,
  linkError,
}: {
  accounts: readonly LoginAccount[];
  linked?: SocialProvider;
  linkError?: SocialProvider;
}) {
  const router = useRouter();
  const byProvider = new Map(accounts.map((account) => [account.provider, account]));
  const canUnlink = accounts.length > 1;

  return (
    <section aria-labelledby="login-accounts-title" className="flex flex-col gap-4 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
      <div className="flex flex-col gap-1">
        <h2 id="login-accounts-title" className="text-body-sm font-semibold text-fg">
          Contas de login
        </h2>
        <p className="text-fg-secondary">Use qualquer conta vinculada para entrar no mesmo perfil do Retake.</p>
      </div>

      {linked ? (
        <p role="status" className="flex items-start gap-2 rounded-control bg-win-tint px-3 py-2.5 text-body-sm text-fg">
          <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-win" />
          {LABELS[linked]} vinculado. Você já pode usar essa conta para entrar.
        </p>
      ) : null}
      {linkError ? (
        <p role="alert" className="rounded-control bg-loss-tint px-3 py-2.5 text-body-sm text-fg">
          Não foi possível vincular o {LABELS[linkError]}. Tente novamente.
        </p>
      ) : null}

      <ul className="divide-y divide-line rounded-control border border-line">
        {PROVIDERS.map((provider) => {
          const account = byProvider.get(provider);
          const label = LABELS[provider];
          return (
            <li key={provider} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-control bg-surface-3 text-fg-secondary">
                  <Link2 aria-hidden="true" className="size-4" />
                </span>
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-fg">{label}</span>
                  <span className="text-label font-normal text-fg-muted">
                    {account ? "Vinculado ao seu perfil" : "Ainda não vinculado"}
                  </span>
                </div>
              </div>

              <div className="w-full sm:w-auto sm:min-w-36">
                {account ? (
                  canUnlink ? (
                    <ConfirmDialog
                      trigger={
                        <Button type="button" variant="destructive" className="w-full">
                          <Unlink aria-hidden="true" />
                          Desvincular
                        </Button>
                      }
                      title={`Desvincular ${label}?`}
                      description={`Você não poderá mais entrar com ${label}. A outra conta vinculada continuará funcionando.`}
                      confirmLabel="Desvincular"
                      pendingLabel="Desvinculando…"
                      onConfirm={async () => {
                        const result = await unlinkLoginAccountAction(account.id);
                        if (!result.ok) {
                          toast.error("Não foi possível desvincular", { description: result.message });
                          return false;
                        }
                        toast.success(`${label} desvinculado`);
                        router.refresh();
                      }}
                    />
                  ) : (
                    <Button type="button" variant="ghost" disabled className="w-full" aria-describedby={`${provider}-only-login`}>
                      Único acesso
                    </Button>
                  )
                ) : (
                  <SocialAuthButtons mode="link" next={`/settings?linked=${provider}`} providers={[provider]} />
                )}
              </div>
              {account && !canUnlink ? (
                <span id={`${provider}-only-login`} className="sr-only">
                  Vincule a outra conta antes de remover esta.
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="text-label font-normal text-fg-muted">Para sua segurança, o Retake nunca permite remover o último método de login.</p>
    </section>
  );
}
