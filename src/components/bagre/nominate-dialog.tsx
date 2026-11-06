"use client";

import { LoaderCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Dialog } from "radix-ui";
import { createContext, use, useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { nominateAction } from "@/app/(app)/groups/bagre-actions";
import { MatchLine } from "@/components/bagre/match-line";
import { Avatar } from "@/components/layout/account-menu";
import { Button } from "@/components/ui/button";
import { formatMatchDate } from "@/lib/format";
import type { NomineeOption } from "@/lib/bagre/queries";
import { COMMENT_MAX, commentSchema } from "@/lib/bagre/validation";
import { cn } from "@/lib/utils";

type Prefill = { nomineeId?: string; matchId?: string };
type Ctx = { open: (prefill?: Prefill) => void; available: boolean };

const NominateContext = createContext<Ctx | null>(null);

/** Why someone can't be picked (or null when they can). */
function blocked(o: NomineeOption): string | null {
  if (o.nominated) return "já indicado";
  if (!o.hasAccount) return "sem Riot ID";
  if (o.lines.length === 0) return "sem partida no período";
  return null;
}

/**
 * Owns the one "Indicar" dialog of the screen; any NominateButton opens it,
 * optionally with someone (and a match) already picked, as the suggestions do.
 */
export function NominateProvider({
  roundId,
  options,
  deadline,
  children,
}: {
  roundId: string;
  options: NomineeOption[];
  /** "domingo, 23h59", for the success toast. */
  deadline: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<{ open: boolean; prefill: Prefill; key: number }>({ open: false, prefill: {}, key: 0 });
  const available = options.some((o) => blocked(o) === null);
  return (
    <NominateContext value={{ available, open: (prefill = {}) => setState((s) => ({ open: true, prefill, key: s.key + 1 })) }}>
      {children}
      <Dialog.Root open={state.open} onOpenChange={(open) => setState((s) => ({ ...s, open }))}>
        <Dialog.Portal>
          <Dialog.Overlay
            className={cn(
              "reduce-fade fixed inset-0 z-50 bg-surface-0/70 backdrop-blur-[2px]",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:duration-200",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:duration-120",
            )}
          />
          <Dialog.Content
            aria-describedby={undefined}
            className={cn(
              "reduce-fade fixed top-1/2 left-1/2 z-50 flex max-h-[min(720px,calc(100dvh-32px))] w-[calc(100%-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col rounded-card-lg border border-line-strong bg-surface-3 shadow-pop",
              "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-200 data-[state=open]:ease-(--ease-out)",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=closed]:duration-120 data-[state=closed]:ease-out",
              "motion-reduce:data-[state=open]:zoom-in-100 motion-reduce:data-[state=closed]:zoom-out-100",
            )}
          >
            <NominateForm
              key={state.key}
              roundId={roundId}
              options={options}
              prefill={state.prefill}
              deadline={deadline}
              onDone={() => setState((s) => ({ ...s, open: false }))}
            />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </NominateContext>
  );
}

export function NominateButton({
  prefill,
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick"> & { prefill?: Prefill }) {
  const ctx = use(NominateContext);
  if (!ctx) throw new Error("NominateButton must be inside NominateProvider");
  return (
    <Button type="button" {...props} disabled={props.disabled || !ctx.available} onClick={() => ctx.open(prefill)}>
      {children}
    </Button>
  );
}

function NominateForm({
  roundId,
  options,
  prefill,
  deadline,
  onDone,
}: {
  roundId: string;
  options: NomineeOption[];
  prefill: Prefill;
  deadline: string;
  onDone: () => void;
}) {
  const router = useRouter();
  const id = useId();
  const initial = options.find((o) => o.userId === prefill.nomineeId && blocked(o) === null);
  const [nomineeId, setNomineeId] = useState(initial?.userId ?? "");
  const [matchId, setMatchId] = useState(
    initial ? (prefill.matchId ?? (initial.lines.length === 1 ? initial.lines[0]!.matchId : "")) : "",
  );
  const [comment, setComment] = useState("");
  const [error, setError] = useState<{ field: "nominee" | "match" | "comment"; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const nominee = options.find((o) => o.userId === nomineeId);
  const length = comment.replace(/\s+/g, " ").trim().length;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!nominee) return setError({ field: "nominee", message: "Escolha quem você quer indicar." });
    if (!matchId) return setError({ field: "match", message: "Escolha a partida." });
    const check = commentSchema.safeParse(comment);
    if (!check.success) return setError({ field: "comment", message: check.error.issues[0]?.message ?? "Confira o comentário." });
    setError(null);
    startTransition(async () => {
      const result = await nominateAction({ roundId, nomineeId, matchId, comment });
      if (!result.ok) {
        if (result.field === "comment") setError({ field: "comment", message: result.message });
        else {
          toast.error("A indicação não foi", { description: result.message });
          if (result.code === "already_nominated" || result.code === "closed") {
            onDone();
            router.refresh();
          }
        }
        return;
      }
      toast.success("Indicação feita", { description: `${nominee.name} está no páreo. Agora é com o grupo: dá para votar até ${deadline}.` });
      onDone();
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex min-h-0 flex-col" aria-busy={pending}>
      <header className="flex items-start justify-between gap-3 border-b border-line-strong px-5 pt-5 pb-4">
        <div className="flex flex-col gap-1">
          <Dialog.Title className="text-body font-semibold text-fg">Indicar ao Bagre</Dialog.Title>
          <p className="text-body-sm text-fg-secondary">Escolha alguém, a partida e conte o motivo. Zoeira leve, combinado?</p>
        </div>
        <Dialog.Close asChild>
          <Button type="button" variant="quiet" size="icon-sm" aria-label="Fechar" className="-mt-1 -mr-2">
            <X aria-hidden="true" />
          </Button>
        </Dialog.Close>
      </header>

      <div className="flex min-h-0 flex-col gap-5 overflow-y-auto px-5 py-4">
        <fieldset className="flex flex-col gap-2" aria-describedby={error?.field === "nominee" ? `${id}-err` : undefined}>
          <legend className="mb-2 text-label text-fg-secondary">Quem</legend>
          <div className="flex flex-col gap-1">
            {options.map((o) => {
              const why = blocked(o);
              const checked = o.userId === nomineeId;
              return (
                <label
                  key={o.userId}
                  className={cn(
                    "hover-layer press relative flex min-h-12 items-center gap-3 rounded-control px-3 py-2 [--hover-bg:rgb(255_255_255/0.04)] [--press-scale:0.99] has-focus-visible:ring-2 has-focus-visible:ring-primary",
                    checked && "on-tint bg-accent-tint shadow-[inset_0_0_0_1px_var(--color-accent-line)]",
                    why && "pointer-events-none opacity-50",
                  )}
                >
                  <input
                    type="radio"
                    name="nominee"
                    value={o.userId}
                    checked={checked}
                    disabled={why !== null}
                    onChange={() => {
                      setNomineeId(o.userId);
                      setMatchId(o.lines.length === 1 ? o.lines[0]!.matchId : "");
                      setError(null);
                    }}
                    className="sr-only"
                  />
                  <Avatar name={o.name} image={o.image} />
                  <span className="flex min-w-0 flex-1 items-baseline gap-1">
                    <span className="truncate text-body-sm text-fg">{o.name}</span>
                    {o.tag ? <span className="font-mono text-label text-fg-muted">#{o.tag}</span> : null}
                  </span>
                  <span className="num shrink-0 text-label font-normal text-fg-muted">
                    {why ?? `${o.lines.length} ${o.lines.length === 1 ? "partida" : "partidas"}`}
                  </span>
                </label>
              );
            })}
            {options.length === 0 ? <p className="text-body-sm text-fg-secondary">Ninguém mais no grupo por enquanto.</p> : null}
          </div>
        </fieldset>

        {nominee ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-label text-fg-secondary">Qual partida</legend>
            <div className="flex flex-col gap-1">
              {nominee.lines.map((l) => {
                const checked = l.matchId === matchId;
                return (
                  <label
                    key={l.matchId}
                    className={cn(
                      "hover-layer press relative flex min-h-12 flex-col gap-1 rounded-control px-3 py-2 [--hover-bg:rgb(255_255_255/0.04)] [--press-scale:0.99] has-focus-visible:ring-2 has-focus-visible:ring-primary",
                      checked && "on-tint bg-accent-tint shadow-[inset_0_0_0_1px_var(--color-accent-line)]",
                    )}
                  >
                    <input
                      type="radio"
                      name="match"
                      value={l.matchId}
                      checked={checked}
                      onChange={() => {
                        setMatchId(l.matchId);
                        setError(null);
                      }}
                      className="sr-only"
                    />
                    <span className="num text-label font-normal text-fg-muted">{formatMatchDate(l.startedAt)}</span>
                    <MatchLine line={l} />
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor={`${id}-comment`} className="text-label text-fg-secondary">
              Motivo
            </label>
            <span
              aria-live="polite"
              className={cn("num text-label font-normal", length > COMMENT_MAX ? "text-loss" : "text-fg-muted")}
            >
              {length}/{COMMENT_MAX}
            </span>
          </div>
          <textarea
            id={`${id}-comment`}
            name="comment"
            rows={2}
            value={comment}
            placeholder="Ex.: quatro abates de Jett e uma granada no próprio pé"
            aria-invalid={error?.field === "comment" ? true : undefined}
            aria-describedby={error?.field === "comment" ? `${id}-err` : undefined}
            onChange={(e) => {
              setComment(e.target.value);
              if (error?.field === "comment") setError(null);
            }}
            className="min-h-16 w-full resize-none rounded-control border border-line bg-surface-2 px-3 py-2.5 text-base text-fg outline-none placeholder:text-fg-muted hover:border-line-strong focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/25 aria-invalid:border-loss aria-invalid:ring-3 aria-invalid:ring-loss/20 sm:text-body-sm"
          />
        </div>
        {error ? (
          <p id={`${id}-err`} role="alert" className="text-body-sm text-loss">
            {error.message}
          </p>
        ) : null}
      </div>

      <footer className="flex flex-col-reverse gap-2 border-t border-line-strong px-5 py-4 sm:flex-row sm:justify-end">
        <Dialog.Close asChild>
          <Button type="button" variant="ghost" disabled={pending}>
            Cancelar
          </Button>
        </Dialog.Close>
        <Button type="submit" disabled={pending} aria-busy={pending}>
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
          {pending ? "Indicando…" : "Indicar"}
        </Button>
      </footer>
    </form>
  );
}
