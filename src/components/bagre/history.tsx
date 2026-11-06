import { History } from "lucide-react";
import Link from "next/link";

import { MatchLine } from "@/components/bagre/match-line";
import { StaggerList } from "@/components/dashboard/stagger-list";
import { Avatar } from "@/components/layout/account-menu";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { BADGE_TITLE, formatPeriod, rangeOf } from "@/lib/bagre/period";
import type { RoundResult } from "@/lib/bagre/results";

const votes = (n: number) => `${n} ${n === 1 ? "voto" : "votos"}`;

function Row({ result }: { result: RoundResult }) {
  const w = result.winner;
  const period = formatPeriod(rangeOf(result));
  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="num text-label font-normal text-fg-muted">
          {period} · {result.cadence === "daily" ? "diário" : "semanal"}
        </span>
        <span className="num shrink-0 text-label font-normal text-fg-muted">
          {result.outcome === "winner" && w ? `${votes(w.votes)} de ${result.votesCast}` : votes(result.votesCast)}
        </span>
      </div>
      {result.outcome === "winner" && w ? (
        <>
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={w.nominee.name} image={w.nominee.image} />
            <span className="truncate font-medium text-fg">{w.nominee.name}</span>
            <Badge variant="outline" className="hidden sm:inline-flex">
              {BADGE_TITLE[result.cadence]}
            </Badge>
            {w.nominee.isYou ? <Badge variant="outline">você</Badge> : null}
          </div>
          <p className="pl-11 text-body-sm text-fg-secondary">
            <span className="text-fg">“{w.comment}”</span>
            {" · "}
            {w.nominator ? (w.nominator.isYou ? "sua indicação" : `indicação de ${w.nominator.name}`) : "indicação de alguém do grupo"}
            {result.byTieBreak ? " · levou no desempate por menos partidas" : ""}
          </p>
          {w.line ? <MatchLine line={w.line} href={w.viewerPlayed ? `/match/${encodeURIComponent(w.matchId)}` : undefined} className="pl-11" /> : null}
        </>
      ) : result.outcome === "tie" ? (
        <p className="text-body-sm text-fg-secondary">
          <span className="font-medium text-fg">Empate declarado</span> entre {result.tied.map((e) => e.nominee.name).join(" e ")}, com{" "}
          {votes(result.tied[0]?.votes ?? 0)} cada. Ninguém levou o selo.
        </p>
      ) : (
        <p className="text-body-sm text-fg-secondary">
          <span className="font-medium text-fg">Sem Bagre.</span> {result.entries.length}{" "}
          {result.entries.length === 1 ? "indicação" : "indicações"} e nenhum voto.
        </p>
      )}
    </div>
  );
}

/** Every closed period with a result: who, when and why (empty periods are left out). */
export function BagreHistory({
  results,
  moreHref,
  firstResult,
}: {
  results: RoundResult[];
  /** Link to the full history when this list is cut. */
  moreHref?: string;
  /** "domingo, 23h59": when the first result comes out (empty state). */
  firstResult?: string;
}) {
  return (
    <section aria-labelledby="history-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="history-title" className="text-body-sm font-semibold text-fg">
          Histórico de Bagres
        </h2>
        <span className="num text-label font-normal text-fg-muted">
          {results.length} {results.length === 1 ? "período" : "períodos"}
        </span>
      </header>
      {results.length === 0 ? (
        <EmptyState
          icon={History}
          title="Nenhum período encerrado ainda"
          description={
            firstResult
              ? `O primeiro resultado sai depois de ${firstResult}, quando a votação fecha. Ele fica guardado aqui.`
              : "Quando um período fechar com indicações, o resultado fica guardado aqui."
          }
        />
      ) : (
        <StaggerList aria-label="Bagres anteriores" className="divide-y divide-line">
          {results.map((r, i) => (
            <li key={r.roundId} style={{ "--i": i } as React.CSSProperties}>
              <Row result={r} />
            </li>
          ))}
        </StaggerList>
      )}
      {moreHref ? (
        <footer className="border-t border-line px-4 py-3">
          <Link
            href={moreHref}
            scroll={false}
            className="inline-flex min-h-11 items-center text-body-sm text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg sm:min-h-0"
          >
            Ver o histórico completo
          </Link>
        </footer>
      ) : null}
    </section>
  );
}
