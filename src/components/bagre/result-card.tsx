import { Fish } from "lucide-react";

import { BagreBadge } from "@/components/bagre/bagre-badge";
import { MatchLine } from "@/components/bagre/match-line";
import { RevealOnce } from "@/components/bagre/reveal-once";
import { VoteBar } from "@/components/bagre/vote-bar";
import { Avatar } from "@/components/layout/account-menu";
import { AnimatedNumber } from "@/components/stats/animated-number";
import { ChamferCard } from "@/components/ui/chamfer-card";
import { formatPeriod, PERIOD_NOUN, rangeOf } from "@/lib/bagre/period";
import type { ResultEntry, RoundResult } from "@/lib/bagre/results";

const matchHref = (e: ResultEntry) => (e.viewerPlayed ? `/match/${encodeURIComponent(e.matchId)}` : undefined);

function Tally({ result }: { result: RoundResult }) {
  const total = result.entries.reduce((sum, e) => sum + e.votes, 0);
  if (result.entries.length < 2 || total === 0) return null;
  return (
    <ul aria-label="Votos de cada indicado" className="flex flex-col gap-2 border-t border-accent-line pt-3">
      {result.entries.map((e) => {
        const top = e === result.winner || result.tied.includes(e);
        return (
          <li key={e.nominationId} className="flex items-center gap-3">
            <span className={top ? "w-24 shrink-0 truncate text-label text-fg" : "w-24 shrink-0 truncate text-label text-fg-secondary"}>
              {e.nominee.name}
            </span>
            <VoteBar share={e.votes / total} mine={top} />
            <span className="num flex w-16 shrink-0 items-center justify-end gap-1 text-label text-fg">
              <AnimatedNumber value={e.votes} align="end" />
              <span className="text-fg-secondary">{e.votes === 1 ? "voto" : "votos"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/**
 * The last closed period, shown until the end of the period after it (the
 * badge window). Winner, declared tie or "nobody voted". Revealed with a
 * one-time entrance per device (RevealOnce). The screen's one chamfered card.
 */
export function ResultCard({ result }: { result: RoundResult }) {
  const period = formatPeriod(rangeOf(result));
  const w = result.winner;

  return (
    <RevealOnce id={result.roundId}>
      <ChamferCard>
        <section aria-labelledby="result-title" className="flex flex-col gap-4">
          <h2 id="result-title" className="flex items-center gap-2 text-eyebrow text-fg-muted uppercase">
            <Fish aria-hidden="true" className="size-3.5 text-primary" />
            Resultado · <span className="num">{period}</span>
          </h2>

          {result.outcome === "winner" && w ? (
            <>
              <div className="flex items-center gap-3">
                <Avatar name={w.nominee.name} image={w.nominee.image} className="size-12 text-body-sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="truncate text-subheading text-fg">{w.nominee.name}</p>
                  <BagreBadge cadence={result.cadence} />
                </div>
                <p className="flex shrink-0 flex-col items-end">
                  <AnimatedNumber value={w.votes} align="end" className="stat text-stat-md text-fg" />
                  <span className="text-eyebrow text-fg-muted uppercase">
                    de {result.votesCast} {result.votesCast === 1 ? "voto" : "votos"}
                  </span>
                </p>
              </div>
              {w.nominee.isYou ? (
                <p className="text-body-sm text-fg-secondary">Foi você. Acontece com todo mundo, e o selo some no fim do próximo período.</p>
              ) : null}
              <blockquote className="flex flex-col gap-1">
                <p className="text-body-sm text-fg">“{w.comment}”</p>
                <footer className="text-label font-normal text-fg-muted">
                  {w.nominator ? (w.nominator.isYou ? "sua indicação" : `indicação de ${w.nominator.name}`) : "indicação de alguém do grupo"}
                </footer>
              </blockquote>
              {w.line ? <MatchLine line={w.line} href={matchHref(w)} /> : null}
              {result.byTieBreak ? (
                <p className="text-label font-normal text-fg-muted">Empate nos votos: levou quem jogou menos partidas no período.</p>
              ) : null}
            </>
          ) : result.outcome === "tie" ? (
            <div className="flex flex-col gap-1">
              <p className="text-subheading text-fg">Empate declarado</p>
              <p className="text-body-sm text-fg-secondary">
                {result.tied.map((e) => e.nominee.name).join(" e ")} empataram nos votos e nas partidas. Ninguém leva o selo desta vez.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              <p className="text-subheading text-fg">Sem Bagre {PERIOD_NOUN[result.cadence].of}</p>
              <p className="text-body-sm text-fg-secondary">Teve indicação, mas ninguém votou. Desta vez todo mundo escapou.</p>
            </div>
          )}

          <Tally result={result} />
        </section>
      </ChamferCard>
    </RevealOnce>
  );
}
