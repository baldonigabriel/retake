import { StaggerList } from "@/components/dashboard/stagger-list";
import { Avatar } from "@/components/layout/account-menu";
import { DeltaChip } from "@/components/stats/delta-chip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type RankingEntry = {
  /** Stable key (user id); falls back to name#tag in the sample data. */
  id?: string;
  name: string;
  tag: string | null;
  image?: string | null;
  /** Text, or an <AnimatedNumber> */
  value: React.ReactNode;
  /** Change vs. last week; null when they didn't play last week. */
  delta: number | null;
  matches: number;
  /** Optional second line, e.g. "4 partidas · 3V 1D". */
  detail?: string;
  isYou?: boolean;
};

/**
 * DESIGN.md › Ranking do grupo: position in Barlow (1º–3º primary, rest muted),
 * avatar, name, highlighted metric value and change vs. last week.
 * The logged-in user is highlighted like in the scoreboard. Rows enter with a
 * stagger on the first load only; values roll when the week or mode changes.
 */
export function RankingList({
  entries,
  metric,
  deltaDigits = 0,
  deltaSuffix,
  className,
}: {
  entries: readonly RankingEntry[];
  metric: string;
  deltaDigits?: number;
  deltaSuffix?: string;
  className?: string;
}) {
  return (
    <StaggerList ordered className={cn("flex flex-col", className)} aria-label={`Ranking da semana por ${metric}`}>
      {entries.map((e, i) => {
        const position = i + 1;
        return (
          <li
            key={e.id ?? `${e.name}#${e.tag}`}
            aria-current={e.isYou ? "true" : undefined}
            style={{ "--i": i } as React.CSSProperties}
            className={cn(
              "flex min-h-14 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0",
              e.isYou && "on-tint bg-accent-tint shadow-[inset_2px_0_0_var(--color-primary)]",
            )}
          >
            <span
              className={cn(
                "stat w-7 shrink-0 text-[22px] leading-none font-bold",
                position <= 3 ? "text-fg" : "text-fg-muted",
              )}
            >
              {position}º
            </span>
            <Avatar name={e.name} image={e.image ?? null} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="flex min-w-0 items-baseline gap-1">
                <span className="truncate font-medium text-fg">{e.name}</span>
                {e.tag ? <span className="hidden font-mono text-label text-fg-muted sm:inline">#{e.tag}</span> : null}
                {e.isYou ? <Badge variant="outline" className="ml-1 self-center">você</Badge> : null}
              </span>
              <span className="num truncate text-label font-normal text-fg-muted">
                {e.detail ?? `${e.matches} ${e.matches === 1 ? "partida" : "partidas"}`}
              </span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-0.5">
              <span className="stat text-[24px] leading-none font-semibold text-fg">
                {e.value}
                <span className="sr-only"> de {metric}</span>
              </span>
              {e.delta === null ? (
                <span className="text-label font-normal text-fg-muted">
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">sem partidas na semana anterior</span>
                </span>
              ) : (
                <DeltaChip value={e.delta} digits={deltaDigits} suffix={deltaSuffix} />
              )}
            </span>
          </li>
        );
      })}
    </StaggerList>
  );
}
