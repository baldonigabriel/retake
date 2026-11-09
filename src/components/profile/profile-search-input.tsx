"use client";

import { LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { parseSearchQuery } from "@/lib/profile/search";
import { tierIconUrl, tierLabel } from "@/lib/ranks";
import { cn } from "@/lib/utils";

type Suggestion = { path: string; gameName: string; tagLine: string; cardUrl: string | null; tier: number | null };
type Status = "idle" | "loading" | "done" | "error" | "limited";

const DEBOUNCE_MS = 250;

/**
 * The search field with suggestions while typing (SPEC §6.4): from the 3rd
 * letter of the name it asks /api/search (debounced, the previous request
 * cancelled) and lists the public profiles found. It is still the `q` field of
 * a plain GET form, so Enter without a highlighted option (or no JavaScript)
 * goes to /search as before. ARIA combobox: ↑/↓ move, Enter opens, Esc closes.
 */
export function ProfileSearchInput({
  id,
  defaultValue = "",
  className,
  listClassName,
  ...input
}: {
  id?: string;
  defaultValue?: string;
  className?: string;
  listClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  "aria-label"?: string;
  "aria-describedby"?: string;
}) {
  const router = useRouter();
  const generated = useId();
  const inputId = id ?? `search-${generated}`;
  const listId = `${inputId}-list`;
  const [value, setValue] = useState(defaultValue);
  const [results, setResults] = useState<Suggestion[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const typed = useRef(false);

  const query = parseSearchQuery(value);
  const searchable = query.kind === "ok";

  useEffect(() => {
    // Only what the person types triggers suggestions, never the value the page loaded with.
    // Below 3 letters the list is hidden (showList), so stale results never show.
    if (!typed.current || !searchable) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal });
        if (res.status === 429) {
          setResults([]);
          setStatus("limited");
          return;
        }
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { results: Suggestion[] };
        setResults(body.results);
        setActive(-1);
        setStatus("done");
      } catch (error) {
        if ((error as Error).name !== "AbortError") setStatus("error");
      }
    }, DEBOUNCE_MS);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [value, searchable]);

  const showList = open && searchable && status !== "idle";
  const allHref = `/search?q=${encodeURIComponent(value.trim())}`;

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      if (showList) event.preventDefault();
      setOpen(false);
      setActive(-1);
      return;
    }
    if (!showList || results.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % results.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      setOpen(false);
      router.push(results[active]!.path);
    }
  }

  return (
    <div className="relative">
      <input
        {...input}
        id={inputId}
        type="search"
        name="q"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        value={value}
        onChange={(event) => {
          typed.current = true;
          setValue(event.target.value);
          setOpen(true);
          if (parseSearchQuery(event.target.value).kind !== "ok") {
            setResults([]);
            setStatus("idle");
          }
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        minLength={3}
        maxLength={40}
        autoComplete="off"
        spellCheck={false}
        className={className}
      />
      {status === "loading" && showList ? (
        <LoaderCircle aria-hidden="true" className="absolute top-1/2 right-2.5 size-4 -translate-y-1/2 animate-spin text-fg-muted motion-reduce:animate-none" />
      ) : null}
      <div
        id={listId}
        role="listbox"
        aria-label="Perfis públicos encontrados"
        hidden={!showList}
        // Keep focus in the field while clicking an option.
        onMouseDown={(event) => event.preventDefault()}
        className={cn(
          "absolute top-full right-0 left-0 z-50 mt-1.5 min-w-64 origin-top overflow-hidden rounded-card border border-line-strong bg-surface-3 shadow-pop",
          "animate-in fade-in-0 zoom-in-95 duration-150 ease-(--ease-out) motion-reduce:zoom-in-100",
          listClassName,
        )}
      >
        {/* Rendered only while open: the closed list leaves nothing behind but the empty box. */}
        {!showList ? null : results.length > 0 ? (
          <ul className="flex flex-col py-1">
            {results.map((r, i) => (
              <li key={r.path} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
                <Link
                  href={r.path}
                  tabIndex={-1}
                  onClick={() => setOpen(false)}
                  onMouseEnter={() => setActive(i)}
                  className={cn("flex min-h-11 items-center gap-3 px-3 py-1.5", i === active && "bg-surface-2")}
                >
                  <span className="size-7 shrink-0 overflow-hidden rounded-chip bg-surface-2">
                    {r.cardUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- community player card asset
                      <img src={r.cardUrl} alt="" width={28} height={28} className="size-full object-cover" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline gap-1">
                    <span className="truncate font-medium text-fg">{r.gameName}</span>
                    <span className="font-mono text-label text-fg-muted">#{r.tagLine}</span>
                  </span>
                  {tierIconUrl(r.tier) ? (
                    // eslint-disable-next-line @next/next/no-img-element -- community rank asset
                    <img src={tierIconUrl(r.tier)} alt={tierLabel(r.tier)} title={tierLabel(r.tier)} width={20} height={20} className="shrink-0" />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p role="status" className="px-3 py-3 text-label font-normal text-fg-secondary">
            {status === "loading"
              ? "Buscando…"
              : status === "limited"
                ? "Muitas buscas seguidas. Espere um minuto."
                : status === "error"
                  ? "Não deu para buscar agora. Aperte Enter para tentar de novo."
                  : "Nenhum perfil público com esse nome."}
          </p>
        )}
        {showList ? (
        <Link
          href={allHref}
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="flex min-h-11 items-center border-t border-line px-3 text-label text-fg-secondary hover:text-fg"
        >
          Ver todos os resultados para “{value.trim()}”
        </Link>
        ) : null}
      </div>
    </div>
  );
}
