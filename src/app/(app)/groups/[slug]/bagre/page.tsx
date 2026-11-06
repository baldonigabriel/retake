import { Fish, Moon, Settings } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Ballot } from "@/components/bagre/ballot";
import { NominateButton, NominateProvider } from "@/components/bagre/nominate-dialog";
import { Suggestions } from "@/components/bagre/suggestions";
import { BackLink } from "@/components/match/back-link";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { db } from "@/db";
import { requireViewer } from "@/lib/auth/session";
import { BADGE_TITLE, formatDeadline, formatPeriod, PERIOD_NOUN, rangeOf } from "@/lib/bagre/period";
import { loadBagreScreen } from "@/lib/bagre/queries";
import { getMembership } from "@/lib/groups/queries";

export const metadata: Metadata = {
  title: "Bagre",
  description: "A votação da atuação mais esquecível do período, só entre o grupo.",
  robots: { index: false, follow: false },
};

const RULES = [
  "Indique alguém do grupo com uma partida deste período e o motivo em até 140 caracteres. Uma indicação por pessoa.",
  "Cada um tem um voto, em quem não for você, e pode trocar até o fim do período.",
  "A contagem aparece depois que você vota. O voto é secreto.",
  "Quem levar fica com o selo até o fim do período seguinte. Empate: fica com quem jogou menos partidas; se continuar, empate declarado.",
];

/**
 * Question this screen answers: "quem foi o Bagre?". Members only (SPEC
 * §5.5): anyone else gets the same 404 as a group that doesn't exist.
 */
export default async function BagrePage({ params }: PageProps<"/groups/[slug]/bagre">) {
  const { slug } = await params;
  const { user } = await requireViewer(`/groups/${slug}/bagre`);
  const membership = await getMembership(slug, user.id);
  if (!membership) notFound();
  const { group, role } = membership;

  const now = new Date();
  const screen = await loadBagreScreen(db(), group, user.id, now);
  const { round } = screen;
  const cadence = round?.cadence ?? group.bagreCadence;
  const deadline = round ? formatDeadline(rangeOf(round), now) : "";
  const hasNominations = screen.nominations.length > 0;
  const canNominate = screen.accepting && screen.options.some((o) => !o.nominated && o.lines.length > 0);

  const header = (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2">
        <h1 className="text-heading text-fg">{BADGE_TITLE[cadence]}</h1>
        {round && group.bagreEnabled ? (
          <p className="num text-fg-secondary">
            {formatPeriod(rangeOf(round))} · {screen.accepting ? `votação até ${deadline}` : "votação encerrada, resultado em instantes"}
          </p>
        ) : null}
      </div>
      {hasNominations && canNominate ? (
        <NominateButton className="w-full sm:w-fit">
          <Fish aria-hidden="true" />
          Indicar alguém
        </NominateButton>
      ) : null}
    </header>
  );

  if (!group.bagreEnabled || !round) {
    return (
      <div className="content-enter flex flex-col gap-4 py-6 sm:py-8">
        <BackLink href={`/groups/${group.slug}`} label={group.name} />
        {header}
        <section className="rounded-card bg-surface-1 shadow-hairline">
          <EmptyState
            icon={Moon}
            title="O Bagre está desligado neste grupo"
            description={
              role === "owner"
                ? "Religue em Ajustes do grupo para voltar a indicar e votar. O histórico continua guardado."
                : "Só quem criou o grupo pode religar. O histórico continua guardado."
            }
            action={
              role === "owner" ? (
                <Link href={`/groups/${group.slug}/settings`} className={buttonVariants()}>
                  <Settings aria-hidden="true" />
                  Abrir ajustes do grupo
                </Link>
              ) : undefined
            }
          />
        </section>
      </div>
    );
  }

  const noMatches = screen.options.every((o) => o.lines.length === 0);

  return (
    <NominateProvider roundId={round.id} options={screen.options} deadline={deadline}>
      <div className="content-enter flex flex-col gap-4 py-6 sm:py-8">
        <BackLink href={`/groups/${group.slug}`} label={group.name} />
        {header}

        <div className="grid gap-4 pt-2 lg:grid-cols-12 lg:items-start">
          <section
            aria-labelledby="nominees-title"
            className="overflow-hidden rounded-card bg-surface-1 shadow-hairline lg:col-span-7"
          >
            <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
              <h2 id="nominees-title" className="text-body-sm font-semibold text-fg">
                Indicados {PERIOD_NOUN[cadence].of}
              </h2>
              <span className="num text-label font-normal text-fg-muted">
                {screen.nominations.length} {screen.nominations.length === 1 ? "indicação" : "indicações"}
              </span>
            </header>
            {hasNominations ? (
              <Ballot nominations={screen.nominations} accepting={screen.accepting} now={now} />
            ) : (
              <EmptyState
                icon={Fish}
                title="Ninguém foi indicado ainda, que tal começar?"
                description={
                  noMatches
                    ? "Ninguém do grupo jogou neste período ainda. Assim que alguém jogar, dá para indicar com a partida."
                    : canNominate
                      ? "Escolha alguém do grupo, uma partida deste período e conte o motivo em até 140 caracteres."
                      : "Só dá para indicar quem jogou neste período, e cada pessoa uma vez."
                }
                action={
                  canNominate ? (
                    <NominateButton>
                      <Fish aria-hidden="true" />
                      Indicar alguém
                    </NominateButton>
                  ) : undefined
                }
              />
            )}
          </section>

          <div className="flex flex-col gap-4 lg:col-span-5">
            <Suggestions suggestions={screen.suggestions} accepting={screen.accepting} />
            <section aria-labelledby="rules-title" className="flex flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline">
              <h2 id="rules-title" className="text-body-sm font-semibold text-fg">
                Como funciona
              </h2>
              <ul className="flex list-disc flex-col gap-2 pl-4 text-body-sm text-fg-secondary marker:text-fg-muted">
                {RULES.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </section>
          </div>
        </div>
      </div>
    </NominateProvider>
  );
}
