import { UsersRound, X } from "lucide-react";
import Link from "next/link";

/**
 * Active "com fulano" filter on the match history, next to the agent and map
 * selects (same height). Removing it is a plain link back to the unfiltered list.
 */
export function WithMateChip({ name, clearHref }: { name: string; clearHref: string }) {
  return (
    <span className="inline-flex min-h-11 max-w-full items-center gap-2 rounded-control bg-surface-2 pl-3 text-label text-fg shadow-hairline sm:min-h-8">
      <UsersRound aria-hidden="true" className="size-3.5 shrink-0 text-fg-muted" />
      <span className="truncate">
        No mesmo time que <span className="font-medium">{name}</span>
      </span>
      <Link
        href={clearHref}
        scroll={false}
        aria-label={`Tirar o filtro: partidas com ${name}`}
        className="hover-layer press relative inline-flex size-11 shrink-0 items-center justify-center rounded-control text-fg-secondary hover:text-fg sm:size-8"
      >
        <X aria-hidden="true" className="size-4" />
      </Link>
    </span>
  );
}
