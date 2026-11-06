"use client";

import { Check, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";

import { voteAction, withdrawNominationAction } from "@/app/(app)/groups/bagre-actions";
import { MatchLine } from "@/components/bagre/match-line";
import { StaggerList } from "@/components/dashboard/stagger-list";
import { Avatar } from "@/components/layout/account-menu";
import { VoteBar } from "@/components/bagre/vote-bar";
import { MotionScope } from "@/components/motion/motion-scope";
import { AnimatedNumber } from "@/components/stats/animated-number";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { NominationView } from "@/lib/bagre/queries";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

function WithdrawButton({ nominationId, name }: { nominationId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="quiet" size="sm" aria-label={`Retirar a indicação de ${name}`}>
          <Undo2 aria-hidden="true" />
          Retirar
        </Button>
      }
      title={`Retirar a indicação de ${name}?`}
      description="Os votos que ela recebeu são apagados e quem votou pode votar de novo. Você pode indicar outra pessoa depois."
      confirmLabel="Retirar indicação"
      pendingLabel="Retirando…"
      onConfirm={async () => {
        const result = await withdrawNominationAction(nominationId);
        if (!result.ok) {
          toast.error("Não deu para retirar", { description: result.message });
          return false;
        }
        toast.success("Indicação retirada");
        router.refresh();
      }}
    />
  );
}

/**
 * The period's nominations, oldest first (never ordered by votes, which
 * would leak the count). Each one: who, the comment, the match (link only for
 * players in it), who nominated and the vote. The vote flips at once
 * (optimistic) and the counts arrive with the refresh; a change of the
 * viewer's own vote rolls the numbers, other people's votes don't.
 */
export function Ballot({
  nominations,
  accepting,
  myVote,
  revealed,
  now,
}: {
  nominations: NominationView[];
  accepting: boolean;
  myVote: string | null;
  revealed: boolean;
  now: Date;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [shownVote, setShownVote] = useOptimistic(myVote);
  const total = nominations.reduce((sum, n) => sum + (n.votes ?? 0), 0);

  function vote(n: NominationView) {
    if (pending || n.id === shownVote) return;
    const changing = shownVote !== null;
    startTransition(async () => {
      setShownVote(n.id);
      const result = await voteAction(n.id);
      if (!result.ok) {
        toast.error("O voto não foi", { description: result.message });
        router.refresh();
        return;
      }
      toast.success(changing ? "Voto trocado" : "Voto registrado", {
        description: changing ? `Agora seu voto é em ${n.nominee.name}.` : "A contagem já está liberada para você.",
      });
      router.refresh();
    });
  }

  return (
    // The viewer's vote is the scope: counts that change with it animate.
    <MotionScope value={myVote ?? ""}>
      <StaggerList aria-label="Indicados" className="divide-y divide-line">
        {nominations.map((n, i) => {
          const mine = n.id === shownVote;
          const canVote = accepting && !n.nominee.isYou;
          return (
            <li
              key={n.id}
              style={{ "--i": i } as React.CSSProperties}
              className={cn("relative flex flex-col gap-2 px-4 py-3", mine && "on-tint bg-accent-tint/60")}
            >
              {mine ? <span aria-hidden="true" className="absolute inset-y-0 left-0 w-0.5 bg-primary" /> : null}
              <div className="flex min-h-11 items-center gap-3">
                <Avatar name={n.nominee.name} image={n.nominee.image} />
                <span className="flex min-w-0 flex-1 items-baseline gap-1">
                  <span className="truncate font-medium text-fg">{n.nominee.name}</span>
                  {n.nominee.tag ? <span className="hidden font-mono text-label text-fg-muted sm:inline">#{n.nominee.tag}</span> : null}
                </span>
                {accepting && n.nominator?.isYou ? <WithdrawButton nominationId={n.id} name={n.nominee.name} /> : null}
                {n.nominee.isYou ? (
                  <Badge variant="outline">você</Badge>
                ) : canVote ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-pressed={mine}
                    aria-label={mine ? `Seu voto: ${n.nominee.name}` : `Votar em ${n.nominee.name}`}
                    onClick={() => vote(n)}
                    className={cn(
                      "min-w-[6.5rem] shrink-0",
                      mine && "border-accent-line bg-accent-tint text-fg [--hover-bg:transparent] hover:text-fg",
                    )}
                  >
                    <span className="grid place-items-center [&>*]:col-start-1 [&>*]:row-start-1">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 transition-opacity duration-150 ease-(--ease-out)",
                          mine ? "opacity-100" : "opacity-0",
                        )}
                        aria-hidden={!mine}
                      >
                        <Check aria-hidden="true" className="size-4 text-primary" />
                        Seu voto
                      </span>
                      <span
                        className={cn("transition-opacity duration-150 ease-(--ease-out)", mine ? "opacity-0" : "opacity-100")}
                        aria-hidden={mine}
                      >
                        {shownVote ? "Trocar voto" : "Votar"}
                      </span>
                    </span>
                  </Button>
                ) : mine ? (
                  <Badge variant="accent">
                    <Check aria-hidden="true" />
                    seu voto
                  </Badge>
                ) : null}
              </div>
              <blockquote className="pl-11 text-body-sm text-fg">“{n.comment}”</blockquote>
              {n.line ? (
                <MatchLine line={n.line} href={n.viewerPlayed ? `/match/${encodeURIComponent(n.matchId)}` : undefined} className="pl-11" />
              ) : null}
              {revealed && n.votes !== null ? (
                <div className="flex items-center gap-3 pl-11">
                  <VoteBar share={total > 0 ? n.votes / total : 0} mine={mine} />
                  <span className="num flex w-16 shrink-0 items-center justify-end gap-1 text-label text-fg">
                    <AnimatedNumber value={n.votes} align="end" />
                    <span className="text-fg-secondary">{n.votes === 1 ? "voto" : "votos"}</span>
                  </span>
                </div>
              ) : null}
              <p className="num pl-11 text-label font-normal text-fg-muted">
                {n.nominator ? (n.nominator.isYou ? "sua indicação" : `indicação de ${n.nominator.name}`) : "indicação de alguém que saiu do grupo"}
                {" · "}
                {formatRelativeTime(n.createdAt, now)}
              </p>
            </li>
          );
        })}
      </StaggerList>
    </MotionScope>
  );
}
