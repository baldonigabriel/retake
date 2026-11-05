import { DeltaChip } from "@/components/stats/delta-chip";
import { cn } from "@/lib/utils";

export type RankingEntry = {
  name: string;
  tag: string;
  value: string;
  delta: number;
  matches: number;
  isYou?: boolean;
};

/**
 * DESIGN.md › Ranking do grupo: position in Barlow (1º–3º primary, rest muted),
 * avatar, name, highlighted metric value and change vs. last week.
 * The logged-in user is highlighted like in the scoreboard.
 */
export function RankingList({
  entries,
  metric,
  className,
}: {
  entries: readonly RankingEntry[];
  metric: string;
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-col", className)} aria-label={`Ranking da semana por ${metric}`}>
      {entries.map((e, i) => {
        const position = i + 1;
        return (
          <li
            key={`${e.name}#${e.tag}`}
            aria-current={e.isYou ? "true" : undefined}
            style={{ animationDelay: `${i * 40}ms` }}
            className={cn(
              "flex h-14 animate-enter items-center gap-3 border-t border-line px-4 first:border-t-0 motion-reduce:animate-none",
              e.isYou && "on-tint bg-accent-tint shadow-[inset_2px_0_0_var(--color-primary)]",
            )}
          >
            <span
              className={cn(
                "stat w-7 text-[22px] leading-none font-bold",
                position <= 3 ? "text-fg" : "text-fg-muted",
              )}
            >
              {position}º
            </span>
            <span
              aria-hidden="true"
              className="inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-surface-3 text-label font-medium text-fg-secondary uppercase"
            >
              {e.name.slice(0, 1)}
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-baseline gap-1">
                <span className="truncate font-medium text-fg">{e.name}</span>
                <span className="font-mono text-label text-fg-muted">#{e.tag}</span>
                {e.isYou ? <span className="text-label text-fg-secondary">(você)</span> : null}
              </span>
              <span className="num text-label text-fg-muted">{e.matches} partidas</span>
            </span>
            <span className="flex flex-col items-end gap-0.5">
              <span className="stat text-[24px] leading-none font-semibold text-fg">
                {e.value}
                <span className="sr-only"> de {metric}</span>
              </span>
              <DeltaChip value={e.delta} digits={0} />
            </span>
          </li>
        );
      })}
    </ol>
  );
}
