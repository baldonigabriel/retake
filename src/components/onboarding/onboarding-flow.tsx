"use client";

import { Check, CircleAlert, LoaderCircle, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";

import {
  importPageAction,
  linkAccountAction,
  previewAccountAction,
  type ActionError,
} from "@/app/(app)/onboarding/actions";
import { Button } from "@/components/ui/button";
import { RiotIdInput } from "@/components/ui/riot-id-input";
import { IMPORT_LIMIT, IMPORT_PAGES } from "@/lib/accounts/initial-import";
import type { RiotAccountPreview } from "@/lib/accounts/link";
import { cn } from "@/lib/utils";

type Step =
  | { kind: "form" }
  | { kind: "preview"; preview: RiotAccountPreview }
  | { kind: "importing"; preview: RiotAccountPreview; page: number; imported: number }
  | { kind: "import-error"; preview: RiotAccountPreview; page: number; imported: number; message: string }
  | { kind: "done"; preview: RiotAccountPreview; imported: number };

const STEPS = ["Riot ID", "Confirmar", "Importar"] as const;
const stepIndex = (step: Step) => (step.kind === "form" ? 0 : step.kind === "preview" ? 1 : 2);

/** Live format check, mirroring parseRiotId (name 3–16, tag 3–5 letters/digits). */
export function riotIdIssue(gameName: string, tagLine: string): string | null {
  const name = gameName.trim();
  const tag = tagLine.trim();
  if (name.length > 0 && name.length < 3) return "O nome tem pelo menos 3 caracteres.";
  if (name.length > 16) return "O nome tem no máximo 16 caracteres.";
  if (tag.length > 0 && !/^[\p{L}\p{N}]+$/u.test(tag)) return "A tag tem só letras e números, sem o #.";
  if (tag.length > 0 && tag.length < 3) return "A tag tem de 3 a 5 caracteres, como BR1.";
  return null;
}

export function OnboardingFlow() {
  const [step, setStep] = useState<Step>({ kind: "form" });
  const current = stepIndex(step);

  // One history page per request; each response advances the bar.
  async function runImport(preview: RiotAccountPreview, page: number, imported: number) {
    setStep({ kind: "importing", preview, page, imported });
    const result = await importPageAction(page);
    if (!result.ok) {
      if (result.code === "import_closed") setStep({ kind: "done", preview, imported });
      else setStep({ kind: "import-error", preview, page, imported, message: result.message });
      return;
    }
    const total = imported + result.inserted;
    if (result.done) setStep({ kind: "done", preview, imported: total });
    else await runImport(preview, page + 1, total);
  }

  return (
    <div className="flex flex-col gap-6">
      <ol aria-label="Etapas" className="flex items-center gap-2 text-label">
        {STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            {i > 0 ? <span aria-hidden="true" className="h-px w-6 bg-line" /> : null}
            <span
              aria-current={i === current ? "step" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5",
                i === current ? "text-fg" : i < current ? "text-fg-secondary" : "text-fg-muted",
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "num inline-flex size-5 items-center justify-center rounded-full text-[11px]",
                  i === current ? "bg-primary text-on-accent" : "bg-surface-3",
                )}
              >
                {i < current ? <Check className="size-3" /> : i + 1}
              </span>
              {label}
              {i < current ? <span className="sr-only"> (concluída)</span> : null}
            </span>
          </li>
        ))}
      </ol>

      <div key={step.kind} className="animate-enter motion-reduce:animate-none">
        {step.kind === "form" ? <RiotIdForm onFound={(preview) => setStep({ kind: "preview", preview })} /> : null}
        {step.kind === "preview" ? (
          <ConfirmAccount
            preview={step.preview}
            onBack={() => setStep({ kind: "form" })}
            onLinked={() => void runImport(step.preview, 0, 0)}
          />
        ) : null}
        {step.kind === "importing" || step.kind === "import-error" ? <ImportProgress step={step} onRetry={() => void runImport(step.preview, step.page, step.imported)} /> : null}
        {step.kind === "done" ? <ImportDone preview={step.preview} imported={step.imported} /> : null}
      </div>
    </div>
  );
}

function RiotIdForm({ onFound }: { onFound: (preview: RiotAccountPreview) => void }) {
  const id = useId();
  const [gameName, setGameName] = useState("");
  const [tagLine, setTagLine] = useState("");
  const [serverError, setServerError] = useState<ActionError | null>(null);
  const [pending, startTransition] = useTransition();
  const tagRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  // Text typed before hydration stays in the DOM but not in state: adopt it.
  useEffect(() => {
    const typedName = nameRef.current?.value ?? "";
    const typedTag = tagRef.current?.value ?? "";
    if (typedName) setGameName(typedName);
    if (typedTag) setTagLine(typedTag);
  }, []);

  const issue = riotIdIssue(gameName, tagLine);
  const complete = gameName.trim().length >= 3 && tagLine.trim().length >= 3 && !issue;
  const message = serverError?.message ?? issue;

  function onNameChange(value: string) {
    setServerError(null);
    // Pasting "Nome#TAG" into the name splits it.
    const hash = value.indexOf("#");
    if (hash !== -1) {
      setGameName(value.slice(0, hash));
      setTagLine(value.slice(hash + 1).replace(/#/g, "").slice(0, 5));
      tagRef.current?.focus();
      return;
    }
    setGameName(value);
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!complete || pending) return;
    startTransition(async () => {
      const result = await previewAccountAction({ gameName, tagLine });
      if (result.ok) onFound(result.preview);
      else setServerError(result);
    });
  }

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className="text-label text-fg-secondary">
          Seu Riot ID
        </label>
        <RiotIdInput
          id={`${id}-name`}
          invalid={Boolean(message)}
          describedBy={`${id}-hint`}
          nameProps={{
            ref: nameRef,
            value: gameName,
            onChange: (e) => onNameChange(e.target.value),
            maxLength: 33,
            autoFocus: true,
            disabled: pending,
          }}
          tagProps={{
            ref: tagRef,
            value: tagLine,
            onChange: (e) => {
              setServerError(null);
              setTagLine(e.target.value.replace(/#/g, ""));
            },
            disabled: pending,
          }}
        />
        <p
          id={`${id}-hint`}
          aria-live="polite"
          className={cn("flex min-h-5 items-start gap-1.5 text-label font-normal", message ? "text-fg" : "text-fg-muted")}
        >
          {message ? (
            <>
              <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0 text-loss" />
              {message}
            </>
          ) : complete ? (
            <>
              <Check aria-hidden="true" className="mt-px size-3.5 shrink-0 text-win" />
              Formato certo. Vamos conferir se a conta existe.
            </>
          ) : (
            "Está no seu perfil do Valorant, como Nome#BR1."
          )}
        </p>
      </div>
      <Button type="submit" disabled={!complete || pending} aria-busy={pending} className="w-full sm:w-fit">
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Search aria-hidden="true" />}
        {pending ? "Buscando conta…" : "Buscar conta"}
      </Button>
    </form>
  );
}

function PlayerCard({ preview }: { preview: RiotAccountPreview }) {
  return (
    <div className="flex items-center gap-4 rounded-card bg-surface-2 p-4 shadow-hairline">
      <span className="size-16 shrink-0 overflow-hidden rounded-control bg-surface-3">
        {preview.cardUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- community player card asset
          <img src={preview.cardUrl} alt="" width={64} height={64} className="size-full object-cover" />
        ) : null}
      </span>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="flex min-w-0 items-baseline gap-1 text-subheading text-fg">
          <span className="truncate">{preview.gameName}</span>
          <span className="font-mono text-body-sm text-fg-muted">#{preview.tagLine}</span>
        </p>
        <p className="num text-label font-normal text-fg-secondary">
          {preview.accountLevel ? `Nível ${preview.accountLevel} · ` : ""}Brasil
        </p>
      </div>
    </div>
  );
}

function ConfirmAccount({
  preview,
  onBack,
  onLinked,
}: {
  preview: RiotAccountPreview;
  onBack: () => void;
  onLinked: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function link() {
    startTransition(async () => {
      const result = await linkAccountAction({ gameName: preview.gameName, tagLine: preview.tagLine });
      if (result.ok) onLinked();
      else setError(result.message);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <PlayerCard preview={preview} />
      <p className="text-fg-secondary">
        Essa conta é sua? Cada pessoa vincula só a própria conta. Depois de vincular, importamos até {IMPORT_LIMIT}{" "}
        partidas recentes.
      </p>
      {error ? (
        <p role="alert" className="flex gap-2 rounded-control bg-loss-tint px-3 py-2.5 text-fg">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-loss" />
          {error}
        </p>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" onClick={link} disabled={pending} aria-busy={pending} className="w-full sm:w-fit">
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
          {pending ? "Vinculando…" : "Sim, vincular esta conta"}
        </Button>
        <Button type="button" variant="ghost" onClick={onBack} disabled={pending} className="w-full sm:w-fit">
          Buscar outro Riot ID
        </Button>
      </div>
    </div>
  );
}

function ImportProgress({
  step,
  onRetry,
}: {
  step: Extract<Step, { kind: "importing" | "import-error" }>;
  onRetry: () => void;
}) {
  const router = useRouter();
  const progress = Math.min(step.page / IMPORT_PAGES, 1);

  return (
    <div className="flex flex-col gap-4">
      <PlayerCard preview={step.preview} />
      <div className="flex flex-col gap-2" aria-live="polite">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium text-fg">
            {step.kind === "importing" ? "Importando suas partidas recentes…" : "A importação parou"}
          </p>
          <p className="num text-label text-fg-secondary">
            <span className="stat text-[20px] leading-none font-semibold text-fg">{step.imported}</span> de até{" "}
            {IMPORT_LIMIT}
          </p>
        </div>
        <div
          role="progressbar"
          aria-label="Progresso da importação"
          aria-valuemin={0}
          aria-valuemax={IMPORT_PAGES}
          aria-valuenow={step.page}
          className="h-1.5 overflow-hidden rounded-full bg-surface-2"
        >
          <div
            className="h-full origin-left rounded-full bg-primary transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${Math.max(progress, 0.04)})` }}
          />
        </div>
        <p className="text-label font-normal text-fg-muted">
          Buscamos 5 partidas por vez para respeitar o limite da API. Leva de 10 a 60 segundos.
        </p>
      </div>

      {step.kind === "import-error" ? (
        <div role="alert" className="flex flex-col gap-3 rounded-control bg-loss-tint p-3">
          <p className="flex gap-2 text-fg">
            <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-loss" />
            {step.message}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button
              type="button"
              onClick={onRetry}
              className="w-full sm:w-fit"
            >
              Tentar de novo
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.push("/me")} className="w-full sm:w-fit">
              Ir para o painel
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ImportDone({ preview, imported }: { preview: RiotAccountPreview; imported: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-4">
      <PlayerCard preview={preview} />
      <div className="flex flex-col gap-1" role="status">
        <p className="font-medium text-fg">
          {imported > 0
            ? `Pronto: ${imported} ${imported === 1 ? "partida importada" : "partidas importadas"}.`
            : "Conta vinculada. Não achamos partidas recentes."}
        </p>
        <p className="text-fg-secondary">
          {imported > 0
            ? "As próximas partidas entram sozinhas a cada 15 minutos, mais ou menos."
            : "Assim que você jogar, a partida aparece no seu painel em até 15 minutos."}
        </p>
      </div>
      <Button
        type="button"
        onClick={() => startTransition(() => router.push("/me"))}
        disabled={pending}
        className="w-full sm:w-fit"
      >
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
        Abrir meu painel
      </Button>
    </div>
  );
}
