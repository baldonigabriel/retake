import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { buttonVariants } from "@/components/ui/button";

/** Temporary landing: the full one (preview with sample data) ships in Phase 4. */
export default function Home() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col justify-center gap-6 px-4 py-24 sm:px-6">
        <Logo />
        <h1 className="max-w-[18ch] text-heading text-fg sm:text-hero">Seu Valorant, comparado com o dos seus amigos.</h1>
        <p className="max-w-prose text-body text-fg-secondary">
          Entre com o Discord, vincule seu Riot ID e veja ACS, K/D, HS%, ADR e rank evoluindo a cada partida.
        </p>
        <Link href="/login" className={buttonVariants({ className: "w-full sm:w-fit" })}>
          Entrar com Discord
        </Link>
      </main>
      <SiteFooter bottomNav={false} />
    </>
  );
}
