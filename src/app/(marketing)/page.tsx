import { Ban, Link2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { DiscordSignInButton } from "@/components/auth/discord-sign-in-button";
import { RankingList } from "@/components/groups/ranking-list";
import { DiscordCardPreview } from "@/components/landing/discord-card-preview";
import { HeroBackdrop } from "@/components/landing/hero-backdrop";
import { Logo } from "@/components/layout/logo";
import { SiteFooter } from "@/components/layout/site-footer";
import { MatchRow } from "@/components/match/match-row";
import { KpiCard } from "@/components/stats/kpi-card";
import { buttonVariants } from "@/components/ui/button";
import { LANDING_NOW, landingCard, landingKpis, landingMatches, landingRanking } from "@/lib/landing-sample";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Retake · Valorant com os seus amigos" },
  description:
    "Tracker de Valorant para grupos de amigos: ACS, K/D, HS%, ADR e rank de cada partida, ranking semanal do grupo e um card no Discord depois de cada jogo.",
};

const STEPS = [
  {
    title: "Entre com o Discord",
    body: "Lemos só nome, avatar e e-mail. Nada é postado em seu nome.",
    fragment: (
      <span className="flex items-center gap-2 text-label font-normal text-fg-secondary">
        <span className="size-2 rounded-full bg-win" aria-hidden="true" />
        Conectado como nyx
      </span>
    ),
  },
  {
    title: "Vincule seu Riot ID",
    body: "Digite Nome#TAG e confira o card do jogador. As partidas recentes entram na hora.",
    fragment: (
      <span className="flex min-h-10 w-full items-center rounded-control bg-surface-2 px-3 shadow-hairline">
        <span className="text-fg">nyx</span>
        <span className="font-mono text-fg-muted">#BR1</span>
      </span>
    ),
  },
  {
    title: "Jogue normalmente",
    body: "A cada 10 a 15 minutos buscamos suas partidas novas. Os números se atualizam sozinhos.",
    fragment: (
      <span className="num flex items-center gap-2 text-label font-normal text-fg-secondary">
        <span className="size-2 rounded-full bg-win" aria-hidden="true" />
        Sincronizado há 4 min · 3 partidas novas
      </span>
    ),
  },
] as const;

const PROMISES = [
  { icon: ShieldCheck, title: "Só a sua conta", body: "Cada pessoa vincula o próprio Riot ID. Quem não usa o Retake aparece só no placar da partida." },
  { icon: Link2, title: "Grupos por convite", body: "Entra quem recebeu o link. O dono troca o link quando quiser e o antigo para na hora." },
  { icon: Ban, title: "Sem scouting", body: "Nunca mostramos números de adversários antes ou durante uma partida." },
] as const;

function SectionHeading({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <div className="flex max-w-[52ch] flex-col gap-3">
      <h2 id={id} className="text-heading text-balance text-fg sm:text-[40px] sm:leading-[1.1] sm:tracking-[-0.01em]">
        {title}
      </h2>
      <p className="text-body text-fg-secondary">{children}</p>
    </div>
  );
}

/** Product preview frame: real components with sample data, not interactive. */
function DashboardPreview() {
  return (
    <div inert className="overflow-hidden rounded-card-lg bg-surface-1 shadow-key">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="size-2.5 rounded-full bg-surface-3" />
          <span className="size-2.5 rounded-full bg-surface-3" />
        </span>
        <span className="truncate font-mono text-label text-fg-muted">retake / me · competitivo</span>
      </div>
      <div className="flex flex-col gap-3 p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {landingKpis.map((k, i) => (
            <KpiCard
              key={k.label}
              label={k.label}
              value={k.value}
              delta={k.delta}
              deltaDigits={"deltaDigits" in k ? k.deltaDigits : 1}
              trend={k.trend}
              deltaSuffix="vs. sua média"
              className={cn("bg-surface-0", i >= 2 && "hidden sm:flex")}
            />
          ))}
        </div>
        <div className="overflow-hidden rounded-card bg-surface-0 shadow-hairline">
          <p className="border-b border-line px-4 py-2.5 text-label text-fg-secondary">Partidas recentes</p>
          <ul className="divide-y divide-line">
            {landingMatches.map((m, i) => (
              <li key={m.id} className={cn(i === 2 && "hidden sm:block")}>
                <MatchRow match={m} now={LANDING_NOW} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <>
      <header className="absolute inset-x-0 top-0 z-10">
        <div className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="Retake, início" className="flex min-h-11 items-center rounded-control">
            <Logo />
          </Link>
          <Link href="/login" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Entrar
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section aria-labelledby="hero-title" className="relative isolate overflow-hidden">
          <HeroBackdrop />
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 pt-32 pb-24 sm:gap-16 sm:px-6 sm:pt-40 lg:pb-30">
            <div className="flex max-w-[44rem] flex-col gap-6">
              <h1 id="hero-title" className="text-[40px] leading-[1.05] font-semibold tracking-[-0.02em] text-balance text-fg sm:text-hero">
                Seu Valorant, comparado com o dos seus amigos.
              </h1>
              <p className="max-w-[56ch] text-body text-fg-secondary sm:text-[18px]">
                O tracker de Valorant para grupos de amigos: ACS, K/D, HS%, ADR e rank de cada partida, um ranking semanal só
                do seu grupo e um card no Discord em até 15 minutos depois do jogo.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="sm:w-56">
                  <DiscordSignInButton next="/me" />
                </div>
                <a href="#como-funciona" className={buttonVariants({ variant: "ghost", className: "w-full sm:w-fit" })}>
                  Ver como funciona
                </a>
              </div>
            </div>
            <DashboardPreview />
          </div>
        </section>

        <section aria-labelledby="how-title" id="como-funciona" className="scroll-mt-8 border-t border-line">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-10 px-4 py-24 sm:px-6 lg:py-30">
            <SectionHeading id="how-title" title="Três passos até o primeiro ranking">
              Nada para instalar e nada para preencher à mão. Os números vêm direto das suas partidas.
            </SectionHeading>
            <ol className="grid gap-3 md:grid-cols-3 md:gap-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex flex-col gap-4 rounded-card bg-surface-1 p-6 shadow-hairline">
                  <span className="stat text-stat-md text-fg-muted" aria-hidden="true">
                    0{i + 1}
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-subheading text-fg">{step.title}</h3>
                    <p className="text-fg-secondary">{step.body}</p>
                  </div>
                  <div className="mt-auto flex min-h-10 items-center border-t border-line pt-4">{step.fragment}</div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section aria-labelledby="group-title" className="border-t border-line">
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:gap-16 lg:py-30">
            <SectionHeading id="group-title" title="Ranking da semana, só entre vocês">
              Crie um grupo, mande o link para a galera e veja quem mandou bem de segunda a domingo, por ACS, K/D, vitórias ou
              partidas. As partidas que vocês jogaram juntos ficam marcadas.
            </SectionHeading>
            <div inert className="overflow-hidden rounded-card-lg bg-surface-1 shadow-key">
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <span className="font-medium text-fg">Os Parças</span>
                <span className="num text-label font-normal text-fg-muted">ACS · vs. semana passada</span>
              </div>
              <RankingList entries={landingRanking} metric="ACS" />
            </div>
          </div>
        </section>

        <section aria-labelledby="discord-title" className="border-t border-line">
          <div className="mx-auto grid w-full max-w-[1200px] items-center gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-16 lg:py-30">
            <div className="lg:order-2">
              <SectionHeading id="discord-title" title="Um card no canal depois de cada partida">
                Terminou o jogo, em até 15 minutos chega no canal do grupo o resultado, o mapa, o agente e os números de quem
                jogou. Um card por partida, mesmo quando cinco de vocês estavam no mesmo time.
              </SectionHeading>
            </div>
            <div className="lg:order-1">
              <DiscordCardPreview payload={landingCard} now={LANDING_NOW} channel="retake" />
            </div>
          </div>
        </section>

        <section aria-labelledby="cta-title" className="border-t border-line">
          <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-12 px-4 py-24 sm:px-6 lg:py-30">
            <ul className="grid gap-8 md:grid-cols-3 md:gap-6">
              {PROMISES.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex flex-col gap-2">
                  <Icon aria-hidden="true" className="size-5 text-fg-secondary" />
                  <h3 className="text-body font-semibold text-fg">{title}</h3>
                  <p className="text-fg-secondary">{body}</p>
                </li>
              ))}
            </ul>
            <div className="flex flex-col gap-6 rounded-card-lg bg-surface-1 p-6 shadow-key sm:p-10 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-col gap-2">
                <h2 id="cta-title" className="text-heading text-fg">
                  Chame o grupo e comece hoje
                </h2>
                <p className="text-body text-fg-secondary">Grátis. Leva um minuto para vincular o Riot ID.</p>
              </div>
              <Link href="/login" className={buttonVariants({ variant: "secondary", className: "w-full md:w-fit" })}>
                Criar minha conta
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter bottomNav={false} />
    </>
  );
}
