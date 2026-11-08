import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { SocialAuthButtons } from "@/components/auth/social-auth-buttons";
import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { safeNextPath } from "@/lib/auth/next-path";
import { getSessionUser } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Entrar",
  description: "Entre no Retake com Google ou Discord.",
};

/** Better Auth redirects back with ?error=<code> when the OAuth flow fails. */
const ERRORS: Record<string, string> = {
  access_denied: "Você cancelou o login. Tente de novo quando quiser.",
  email_not_found: "Essa conta não tem e-mail verificado. Verifique o e-mail no provedor e tente de novo.",
  account_not_linked: "Essa conta ainda não está vinculada. Entre pelo outro método e vincule-a em Ajustes.",
};
const GENERIC_ERROR = "Não conseguimos concluir o login. Tente de novo em alguns segundos.";

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
          Escolha Google ou Discord. As duas opções levam ao mesmo perfil do Retake.
        </p>
      </div>

      {error ? (
        <p role="alert" className="flex gap-2 rounded-control bg-loss-tint px-3 py-2.5 text-fg">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-loss" />
          {error}
        </p>
      ) : null}

      <SocialAuthButtons next={next} />

      <p className="text-label font-normal text-fg-muted">
        Depois você pode vincular a outra conta em Ajustes. Lemos apenas nome, avatar e e-mail; nada é publicado em seu nome.
      </p>
    </section>
  );
}
