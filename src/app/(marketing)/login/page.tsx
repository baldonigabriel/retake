import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button";
import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { safeNextPath } from "@/lib/auth/next-path";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre no Retake com sua conta do Discord.",
};

/** Better Auth redirects back with ?error=<code> when the OAuth flow fails. */
const ERRORS: Record<string, string> = {
  access_denied: "Você cancelou o login no Discord. Tente de novo quando quiser.",
  email_not_found: "Sua conta do Discord não tem e-mail verificado. Verifique o e-mail no Discord e tente de novo.",
};
const GENERIC_ERROR = "Não conseguimos concluir o login com o Discord. Tente de novo em alguns segundos.";

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <>
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-sm flex-col gap-8">
          <Link href="/" aria-label="Retake, início" className="flex min-h-11 w-fit items-center rounded-control">
            <Logo />
          </Link>
          <Suspense fallback={<LoginCard next="/me" />}>
            <LoginContent searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
      <SiteFooter bottomNav={false} />
    </>
  );
}

async function LoginContent({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  if (await getSessionUser()) redirect(next);

  const code = typeof params.error === "string" ? params.error : undefined;
  return <LoginCard next={next} error={code ? (ERRORS[code] ?? GENERIC_ERROR) : undefined} />;
}

function LoginCard({ next, error }: { next: string; error?: string }) {
  return (
    <section aria-labelledby="login-title" className="flex flex-col gap-6 rounded-card-lg bg-surface-1 p-6 shadow-key">
      <div className="flex flex-col gap-2">
        <h1 id="login-title" className="text-heading text-fg">
          Entrar no Retake
        </h1>
        <p className="text-fg-secondary">
          Use sua conta do Discord. Em seguida você vincula seu Riot ID e importamos suas partidas recentes.
        </p>
      </div>

      {error ? (
        <p role="alert" className="flex gap-2 rounded-control bg-loss-tint px-3 py-2.5 text-fg">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-loss" />
          {error}
        </p>
      ) : null}

      <DiscordSignInButton next={next} />

      <p className="text-label font-normal text-fg-muted">
        Lemos só seu nome, avatar e e-mail do Discord. Nada é postado em seu nome.
      </p>
    </section>
  );
}
