import { ChevronRight, Fish } from "lucide-react";
import Link from "next/link";

import { Avatar } from "@/components/layout/account-menu";
import type { BagreTeaser } from "@/lib/bagre/teaser";

/**
 * Group page teaser: the current badge holder (if any) and how the period is
 * going, linking to the Bagre screen. Never the vote count: that only shows
 * to whoever already voted, on the Bagre screen.
 */
export function BagreCard({ href, teaser }: { href: string; teaser: BagreTeaser }) {
  const { holder, nominations, voters, deadline, title } = teaser;
  return (
    <Link
      href={href}
      className="hover-layer press group/card relative flex flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline [--hover-ring:inset_0_0_0_1px_var(--color-line-strong)] sm:p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-eyebrow text-fg-muted uppercase">
          <Fish aria-hidden="true" className="size-3.5" />
          {title}
        </h2>
        <ChevronRight aria-hidden="true" className="size-4 text-fg-muted group-hover/card:text-fg" />
      </div>
      {holder ? (
        <div className="flex items-center gap-3">
          <Avatar name={holder.name} image={holder.image} />
          <p className="min-w-0 text-body-sm text-fg-secondary">
            <span className="font-medium text-fg">{holder.isYou ? "Você" : holder.name}</span> está com o selo {holder.of}.
          </p>
        </div>
      ) : null}
      <p className="num text-body-sm text-fg-secondary">
        {deadline === null
          ? "Abra para indicar alguém e votar neste período."
          : nominations === 0
            ? `Ninguém indicado ainda. Dá para indicar e votar até ${deadline}.`
            : `${nominations} ${nominations === 1 ? "indicação" : "indicações"}${voters > 0 ? ` · ${voters} ${voters === 1 ? "voto" : "votos"}` : ""} · até ${deadline}`}
      </p>
    </Link>
  );
}
