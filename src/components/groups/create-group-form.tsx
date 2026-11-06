"use client";

import { LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { toast } from "sonner";

import { createGroupAction } from "@/app/(app)/groups/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { groupNameSchema, slugSchema, slugify } from "@/lib/groups/validation";
import { cn } from "@/lib/utils";

/**
 * Name + unique address. The address follows the name until the user edits
 * it. Errors show after the field was touched (or on submit), never while the
 * user is still typing the first characters.
 */
export function CreateGroupForm({ className }: { className?: string }) {
  const router = useRouter();
  const id = useId();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [touched, setTouched] = useState({ name: false, slug: false });
  const [serverError, setServerError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, startTransition] = useTransition();

  const nameCheck = groupNameSchema.safeParse(name);
  const slugCheck = slugSchema.safeParse(slug);
  const nameError =
    serverError?.field === "name" ? serverError.message : touched.name && !nameCheck.success ? nameCheck.error.issues[0]?.message : null;
  const slugError =
    serverError?.field === "slug" ? serverError.message : touched.slug && !slugCheck.success ? slugCheck.error.issues[0]?.message : null;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTouched({ name: true, slug: true });
    if (!nameCheck.success || !slugCheck.success) return;
    setServerError(null);
    startTransition(async () => {
      const result = await createGroupAction({ name, slug });
      if (!result.ok) {
        if (result.field) setServerError({ field: result.field, message: result.message });
        else toast.error("Não deu para criar o grupo", { description: result.message });
        return;
      }
      toast.success(`Grupo “${name.trim()}” criado`, { description: "Agora copie o link de convite e mande para a galera." });
      router.push(`/groups/${result.slug}`);
    });
  }

  return (
    <form onSubmit={submit} noValidate className={cn("flex flex-col gap-4", className)} aria-busy={pending}>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className="text-label text-fg-secondary">
          Nome do grupo
        </label>
        <Input
          id={`${id}-name`}
          name="name"
          value={name}
          autoComplete="off"
          maxLength={40}
          placeholder="Os Parças"
          aria-invalid={nameError ? true : undefined}
          aria-describedby={nameError ? `${id}-name-error` : undefined}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
            if (serverError?.field === "name") setServerError(null);
          }}
          onBlur={() => setTouched((t) => ({ ...t, name: name.length > 0 || t.name }))}
        />
        {nameError ? (
          <p id={`${id}-name-error`} role="alert" className="text-label font-normal text-loss">
            {nameError}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-slug`} className="text-label text-fg-secondary">
          Endereço do grupo
        </label>
        <div
          className={cn(
            "flex min-h-11 items-center rounded-control border border-line bg-surface-2 transition-[border-color,box-shadow] duration-150 ease-out focus-within:border-primary focus-within:ring-3 focus-within:ring-primary/25 hover:border-line-strong sm:min-h-10",
            slugError && "border-loss ring-3 ring-loss/20",
          )}
        >
          <span aria-hidden="true" className="pl-3 font-mono text-label text-fg-muted select-none">
            /groups/
          </span>
          <input
            id={`${id}-slug`}
            name="slug"
            value={slug}
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={32}
            placeholder="os-parcas"
            aria-invalid={slugError ? true : undefined}
            aria-describedby={`${id}-slug-hint${slugError ? ` ${id}-slug-error` : ""}`}
            className="min-w-0 flex-1 bg-transparent py-2.5 pr-3 font-mono text-base text-fg outline-none placeholder:text-fg-muted focus-visible:outline-none sm:text-body-sm"
            onChange={(e) => {
              setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
              setSlugEdited(true);
              if (serverError?.field === "slug") setServerError(null);
            }}
            onBlur={() => setTouched((t) => ({ ...t, slug: slug.length > 0 || t.slug }))}
          />
        </div>
        {slugError ? (
          <p id={`${id}-slug-error`} role="alert" className="text-label font-normal text-loss">
            {slugError}
          </p>
        ) : (
          <p id={`${id}-slug-hint`} className="text-label font-normal text-fg-muted">
            Único no Retake. Só quem estiver no grupo consegue abrir.
          </p>
        )}
      </div>

      <Button type="submit" disabled={pending} className="w-full sm:w-fit">
        {pending ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : null}
        {pending ? "Criando…" : "Criar grupo"}
      </Button>
    </form>
  );
}
