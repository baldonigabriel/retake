import { mapThumbUrl } from "@/lib/assets";
import { formatNumber, formatPercent } from "@/lib/format";
import type { GroupStats } from "@/lib/stats/breakdown";
import { cn } from "@/lib/utils";

/**
 * Per-map tiles. The community map thumbnail sits under a surface-0 overlay
 * at 85% so it never competes with the numbers (DESIGN.md › Imagens). Text
 * over the art uses fg-secondary, never muted: bright parts of a map under
 * the overlay drop muted grey below 4.5:1.
 */
export function MapGrid({ maps, className }: { maps: readonly GroupStats[]; className?: string }) {
  return (
    <ul className={cn("grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 lg:grid-cols-2", className)}>
      {maps.map((m) => {
        const thumb = mapThumbUrl(m.id);
        const wr = m.summary.winRate;
        return (
          <li key={m.key} className="relative isolate overflow-hidden rounded-control bg-surface-2 shadow-hairline">
            {thumb ? (
              <span
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-cover bg-center"
                style={{ backgroundImage: `url(${thumb})` }}
              />
            ) : null}
            <span aria-hidden="true" className="absolute inset-0 -z-10 bg-surface-0/85" />
            <div className="flex flex-col gap-2 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="truncate font-medium text-fg">{m.name}</p>
                <p className="num shrink-0 text-label font-normal text-fg-secondary">
                  {m.summary.matches} {m.summary.matches === 1 ? "partida" : "partidas"}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-2">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-eyebrow text-fg-secondary uppercase">ACS</dt>
                  <dd className="stat text-[24px] leading-none font-semibold text-fg">
                    {formatNumber(Math.round(m.summary.acs))}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-eyebrow text-fg-secondary uppercase">Vitórias</dt>
                  <dd className="stat text-[24px] leading-none font-semibold text-fg">
                    {formatPercent(wr.rate, 0)}
                    <span className="sr-only">
                      {" "}
                      ({wr.wins} vitórias, {wr.losses} derrotas{wr.draws ? `, ${wr.draws} empates` : ""})
                    </span>
                  </dd>
                </div>
              </dl>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
