import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { NominateButton } from "@/components/bagre/nominate-dialog";
import { Avatar } from "@/components/layout/account-menu";
import { Badge } from "@/components/ui/badge";
import type { BagreScreen } from "@/lib/bagre/queries";
import { SUGGESTION_LABEL } from "@/lib/stats/bagre";

/**
 * Up to three suggestions from the period's competitive matches (SPEC §5.2).
 * A shortcut only: "Indicar" opens the dialog with the person and match picked.
 */
export function Suggestions({ suggestions, accepting }: { suggestions: BagreScreen["suggestions"]; accepting: boolean }) {
  return (
    <section aria-labelledby="suggestions-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex flex-col gap-0.5 border-b border-line px-4 py-3">
        <h2 id="suggestions-title" className="text-body-sm font-semibold text-fg">
          Sugestões dos números
        </h2>
        <p className="text-label font-normal text-fg-muted">Pelas competitivas do período. Só vira indicação se alguém indicar.</p>
      </header>
      {suggestions.length === 0 ? (
        <p className="px-4 py-4 text-body-sm text-fg-secondary">
          Nada gritante nos números até agora. Bom sinal para o grupo, ou ninguém jogou o bastante ainda.
        </p>
      ) : (
        <ul className="divide-y divide-line">
          {suggestions.map((s) => (
            <li key={s.userId} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center gap-3">
                <Avatar name={s.person.name} image={s.person.image} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate font-medium text-fg">{s.person.name}</span>
                  <span className="text-label font-normal text-fg-muted">{SUGGESTION_LABEL[s.kind]}</span>
                </span>
                {s.person.isYou ? (
                  <Badge variant="outline">é você</Badge>
                ) : s.nominated ? (
                  <Badge>já indicado</Badge>
                ) : accepting ? (
                  <NominateButton
                    variant="ghost"
                    size="sm"
                    prefill={{ nomineeId: s.userId, matchId: s.matchId }}
                    aria-label={`Indicar ${s.person.name}`}
                  >
                    Indicar
                  </NominateButton>
                ) : null}
              </div>
              <p className="num pl-11 text-body-sm text-fg-secondary">
                {s.reason}
                {s.viewerPlayed ? (
                  <>
                    {" · "}
                    <Link
                      href={`/match/${encodeURIComponent(s.matchId)}`}
                      className="inline-flex min-h-11 items-center gap-0.5 text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg sm:min-h-0"
                    >
                      Ver partida
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </>
                ) : null}
              </p>
              {s.person.isYou ? <p className="pl-11 text-label font-normal text-fg-muted">Você está na lista. Melhor torcer.</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
