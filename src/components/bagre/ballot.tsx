"use client";

import { Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { withdrawNominationAction } from "@/app/(app)/groups/bagre-actions";
import { MatchLine } from "@/components/bagre/match-line";
import { StaggerList } from "@/components/dashboard/stagger-list";
import { Avatar } from "@/components/layout/account-menu";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { NominationView } from "@/lib/bagre/queries";
import { formatRelativeTime } from "@/lib/format";

function WithdrawButton({ nominationId, name }: { nominationId: string; name: string }) {
  const router = useRouter();
  return (
    <ConfirmDialog
      trigger={
        <Button type="button" variant="quiet" size="sm" className="-mr-2">
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
 * The period's nominations, oldest first. Each one: who, the comment, the
 * match (link only for players in it) and who nominated.
 */
export function Ballot({ nominations, accepting, now }: { nominations: NominationView[]; accepting: boolean; now: Date }) {
  return (
    <StaggerList aria-label="Indicados" className="divide-y divide-line">
      {nominations.map((n, i) => (
        <li key={n.id} style={{ "--i": i } as React.CSSProperties} className="flex flex-col gap-2 px-4 py-3">
          <div className="flex min-h-8 items-center gap-3">
            <Avatar name={n.nominee.name} image={n.nominee.image} />
            <span className="flex min-w-0 flex-1 items-baseline gap-1">
              <span className="truncate font-medium text-fg">{n.nominee.name}</span>
              {n.nominee.tag ? <span className="font-mono text-label text-fg-muted">#{n.nominee.tag}</span> : null}
            </span>
            {n.nominee.isYou ? <Badge variant="outline">você</Badge> : null}
            {accepting && n.nominator?.isYou ? <WithdrawButton nominationId={n.id} name={n.nominee.name} /> : null}
          </div>
          <blockquote className="pl-11 text-body-sm text-fg">“{n.comment}”</blockquote>
          {n.line ? (
            <MatchLine line={n.line} href={n.viewerPlayed ? `/match/${encodeURIComponent(n.matchId)}` : undefined} className="pl-11" />
          ) : null}
          <p className="num pl-11 text-label font-normal text-fg-muted">
            {n.nominator ? (n.nominator.isYou ? "sua indicação" : `indicação de ${n.nominator.name}`) : "indicação de alguém que saiu do grupo"}
            {" · "}
            {formatRelativeTime(n.createdAt, now)}
          </p>
        </li>
      ))}
    </StaggerList>
  );
}
