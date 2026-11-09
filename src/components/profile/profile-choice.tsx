"use client";

import { Check, CircleAlert, Eye, EyeOff, LoaderCircle, Lock } from "lucide-react";
import { useId, useState, useTransition } from "react";

import { saveProfileAction } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import {
  ALL_FIELDS_ON,
  PROFILE_FIELDS,
  visibleFields,
  type ProfileChoice as Choice,
  type ProfileFields,
} from "@/lib/profile/settings";
import { cn } from "@/lib/utils";

type Visibility = Choice["visibility"];

const OPTIONS: readonly { value: Visibility; label: string; body: string; icon: typeof Eye }[] = [
  {
    value: "public",
    label: "Público",
    body: "Qualquer pessoa com o link ou pela busca vê o que você escolher abaixo. Grupos e Bagre nunca aparecem.",
    icon: Eye,
  },
  {
    value: "private",
    label: "Privado",
    body: "Só você e quem está nos seus grupos veem seus números. Seu nome não aparece na busca.",
    icon: EyeOff,
  },
];

/**
 * The public/private question (SPEC §6.2), shared by onboarding, the /me card
 * and Ajustes. Two options with the same weight and nothing pre-selected
 * until the user has answered once; "Público" opens the section list (all on)
 * with a preview of the page. The save button is the screen's one primary.
 */
export function ProfileChoice({
  initial,
  riotId,
  submitLabel = "Salvar escolha",
  onSaved,
  compact = false,
  secondaryAction,
}: {
  /** null = never answered: nothing pre-selected. */
  initial: Choice | null;
  riotId: { gameName: string; tagLine: string };
  submitLabel?: string;
  onSaved?: (result: { visible: boolean }) => void;
  /** Hides the preview (the /me card keeps it short). */
  compact?: boolean;
  /** Rendered next to the save button (the /me card's "Agora não"). */
  secondaryAction?: React.ReactNode;
}) {
  const id = useId();
  const [visibility, setVisibility] = useState<Visibility | null>(initial?.visibility ?? null);
  const [fields, setFields] = useState<ProfileFields>(initial?.fields ?? ALL_FIELDS_ON);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const nothingChecked = visibleFields(fields).length === 0;

  function save(event: React.FormEvent) {
    event.preventDefault();
    if (!visibility || pending) return;
    setError(null);
    startTransition(async () => {
      const result = await saveProfileAction({ visibility, fields });
      if (!result.ok) {
        setError(result.message);
        return;
      }
      setSaved(true);
      onSaved?.({ visible: result.visible });
    });
  }

  function change(next: () => void) {
    setSaved(false);
    setError(null);
    next();
  }

  return (
    <form onSubmit={save} className="@container flex flex-col gap-4" aria-describedby={`${id}-status`}>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-label text-fg-secondary">Quem pode ver seu perfil</legend>
        <div className="grid gap-2 @md:grid-cols-2">
          {OPTIONS.map((option) => {
            const Icon = option.icon;
            const checked = visibility === option.value;
            return (
              <label
                key={option.value}
                className={cn(
                  "hover-layer press relative flex cursor-pointer gap-3 rounded-control p-3 [--press-scale:0.99]",
                  "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-primary",
                  checked ? "bg-accent-tint shadow-[inset_0_0_0_1px_var(--color-accent-line)]" : "bg-surface-2 shadow-hairline",
                )}
              >
                <input
                  type="radio"
                  name={`${id}-visibility`}
                  value={option.value}
                  checked={checked}
                  onChange={() => change(() => setVisibility(option.value))}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full",
                    checked ? "bg-primary" : "shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]",
                  )}
                >
                  {checked ? <span className="size-1.5 rounded-full bg-on-accent" /> : null}
                </span>
                <span className="flex min-w-0 flex-col gap-1">
                  <span className={cn("flex items-center gap-1.5 font-medium", checked ? "text-fg" : "text-fg-secondary")}>
                    <Icon aria-hidden="true" className="size-4 text-fg-muted" />
                    {option.label}
                  </span>
                  <span className="text-label font-normal text-fg-secondary">{option.body}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      {visibility === "public" ? (
        <div className={cn("grid gap-4", !compact && "@xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-label text-fg-secondary">O que aparece</legend>
            {PROFILE_FIELDS.map((field) => (
              <label
                key={field.key}
                className="hover-layer relative flex min-h-11 cursor-pointer items-start gap-3 rounded-control px-2 py-2 has-focus-visible:outline-2 has-focus-visible:outline-primary"
              >
                <input
                  type="checkbox"
                  checked={fields[field.key]}
                  onChange={(e) => change(() => setFields((f) => ({ ...f, [field.key]: e.target.checked })))}
                  className="peer sr-only"
                />
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-[4px]",
                    fields[field.key] ? "bg-primary text-on-accent" : "shadow-[inset_0_0_0_1.5px_var(--color-line-strong)]",
                  )}
                >
                  {fields[field.key] ? <Check className="size-3" strokeWidth={3} /> : null}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-body-sm text-fg">{field.label}</span>
                  <span className="text-label font-normal text-fg-muted">{field.description}</span>
                </span>
              </label>
            ))}
            {nothingChecked ? (
              <p className="mt-1 flex gap-2 rounded-control bg-surface-2 px-3 py-2 text-label font-normal text-fg">
                <Lock aria-hidden="true" className="mt-px size-3.5 shrink-0 text-fg-muted" />
                Sem nenhuma seção marcada, seu perfil fica privado.
              </p>
            ) : null}
          </fieldset>
          {compact ? null : <ProfilePreview riotId={riotId} fields={fields} />}
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="flex gap-2 rounded-control bg-loss-tint px-3 py-2.5 text-fg">
          <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-loss" />
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Button type="submit" disabled={!visibility || pending} aria-busy={pending} className="w-full sm:w-fit">
          {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
          {pending ? "Salvando…" : submitLabel}
        </Button>
        {secondaryAction}
        <p id={`${id}-status`} aria-live="polite" className="text-label font-normal text-fg-muted">
          {saved
            ? visibility === "public" && !nothingChecked
              ? "Salvo. Seu perfil já está público."
              : "Salvo. Seu perfil está privado."
            : !visibility
              ? "Escolha uma das opções para continuar. Dá para mudar depois em Ajustes."
              : "Vale na hora e dá para mudar quando quiser em Ajustes."}
        </p>
      </div>
    </form>
  );
}

const PREVIEW_BLOCKS: Record<keyof ProfileFields, { label: string; className: string }> = {
  showRank: { label: "Rank e RR", className: "h-10" },
  showOverview: { label: "Visão geral", className: "h-14" },
  showAgents: { label: "Agentes", className: "h-12" },
  showMaps: { label: "Mapas", className: "h-10" },
  showWeapons: { label: "Armas", className: "h-10" },
  showMatches: { label: "Últimas partidas", className: "h-14" },
};

/** A schematic of the public page: only the checked sections, in page order. */
function ProfilePreview({ riotId, fields }: { riotId: { gameName: string; tagLine: string }; fields: ProfileFields }) {
  const shown = visibleFields(fields);
  return (
    <figure aria-label="Prévia do seu perfil público" className="overflow-hidden rounded-card bg-surface-0 shadow-hairline">
      <figcaption className="flex items-center gap-2 border-b border-line px-3 py-2">
        <span className="truncate font-mono text-label text-fg-muted">
          retake / u / {riotId.gameName}-{riotId.tagLine}
        </span>
      </figcaption>
      <div className="flex flex-col gap-2 p-3">
        <p className="flex min-w-0 items-baseline gap-1 text-body-sm font-semibold text-fg">
          <span className="truncate">{riotId.gameName}</span>
          <span className="font-mono text-label font-normal text-fg-muted">#{riotId.tagLine}</span>
        </p>
        {shown.length === 0 ? (
          <p className="flex min-h-24 items-center justify-center rounded-control bg-surface-1 px-3 text-center text-label font-normal text-fg-muted">
            Perfil privado: quem abrir o link vê “perfil não encontrado”.
          </p>
        ) : (
          shown.map((key) => (
            <div
              key={key}
              className={cn("flex items-start rounded-control bg-surface-1 px-2.5 py-2 shadow-hairline", PREVIEW_BLOCKS[key].className)}
            >
              <span className="text-eyebrow text-fg-muted uppercase">{PREVIEW_BLOCKS[key].label}</span>
            </div>
          ))
        )}
      </div>
    </figure>
  );
}
