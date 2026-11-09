import { Search } from "lucide-react";
import Link from "next/link";

import { ProfileSearchInput } from "@/components/profile/profile-search-input";
import { cn } from "@/lib/utils";

/**
 * Public profile search in the header (SPEC §6.4). A plain GET form to
 * /search, so it works before JavaScript loads; once it does, suggestions
 * show up while typing. On phones it is a 44px icon
 * link to the search page instead of a field.
 */
export function HeaderSearch({ className }: { className?: string }) {
  return (
    <>
      <form action="/search" role="search" aria-label="Buscar perfis públicos" className={cn("relative hidden md:block", className)}>
        <Search aria-hidden="true" className="pointer-events-none absolute top-1/2 z-10 left-2.5 size-4 -translate-y-1/2 text-fg-muted" />
        <ProfileSearchInput
          placeholder="Buscar perfil"
          aria-label="Buscar perfil público por Riot ID"
          listClassName="left-auto w-72"
          className="h-8 w-44 rounded-control border border-line bg-surface-2 pr-8 pl-8 text-body-sm text-fg placeholder:text-fg-muted focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_rgba(255,70,85,0.25)] focus-visible:outline-none lg:w-52"
        />
      </form>
      <Link
        href="/search"
        aria-label="Buscar perfis públicos"
        className="hover-layer press relative inline-flex size-11 items-center justify-center rounded-control text-fg-secondary md:hidden"
      >
        <Search aria-hidden="true" className="size-5" />
      </Link>
    </>
  );
}
