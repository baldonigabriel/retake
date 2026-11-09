import { Search } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The search field of /search and the landing (SPEC §6.4). A plain GET form
 * so it works before JavaScript loads and the query lives in the URL.
 */
export function ProfileSearchForm({
  defaultValue = "",
  autoFocus = false,
  buttonVariant = "default",
  className,
  id = "profile-search",
}: {
  defaultValue?: string;
  autoFocus?: boolean;
  /** The landing already has its primary button: the search uses the ghost one there. */
  buttonVariant?: "default" | "ghost";
  className?: string;
  id?: string;
}) {
  return (
    <form action="/search" role="search" className={cn("flex w-full flex-col gap-2", className)}>
      <label htmlFor={id} className="text-label text-fg-secondary">
        Buscar perfil público
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-fg-muted" />
          <input
            id={id}
            type="search"
            name="q"
            defaultValue={defaultValue}
            placeholder="Nome ou Nome#TAG"
            aria-describedby={`${id}-hint`}
            minLength={3}
            maxLength={40}
            autoComplete="off"
            autoFocus={autoFocus}
            className="h-11 w-full rounded-control border border-line bg-surface-2 pr-3 pl-9 text-body-sm text-fg placeholder:text-fg-muted focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(255,70,85,0.25)] focus-visible:outline-none sm:h-10"
          />
        </div>
        <button type="submit" className={buttonVariants({ variant: buttonVariant, className: "w-full sm:w-fit" })}>
          Buscar
        </button>
      </div>
      <p id={`${id}-hint`} className="text-label font-normal text-fg-muted">
        Pelo menos 3 letras do nome. Só aparecem jogadores que escolheram ter perfil público.
      </p>
    </form>
  );
}
