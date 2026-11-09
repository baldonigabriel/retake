import { Target } from "lucide-react";

import { weaponIconUrl } from "@/lib/assets";
import { formatNumber, formatPercent } from "@/lib/format";
import type { WeaponMetric } from "@/lib/rounds";

/**
 * Kills and approximate HS% per buy-menu weapon (abilities, ultimates and the
 * knife are filtered out in lib/rounds). Each row carries the weapon
 * silhouette and a bar with its share of the kills of the most-used weapon.
 */
export function WeaponsPanel({ weapons }: { weapons: readonly WeaponMetric[] }) {
  const top = Math.max(1, ...weapons.map((w) => w.kills));
  return (
    <section aria-labelledby="weapons-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="weapons-title" className="text-body-sm font-semibold text-fg">Armas</h2>
          <p className="text-label font-normal text-fg-muted">HS% aproximado pela arma comprada no round; abates são exatos.</p>
        </div>
        <Target aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-muted" />
      </header>
      {weapons.length === 0 ? (
        <p className="px-4 py-5 text-fg-secondary">Sem amostra de armas nas partidas deste filtro.</p>
      ) : (
        <>
          <div
            aria-hidden="true"
            className="hidden grid-cols-[8rem_minmax(0,1fr)_5rem_5.5rem_4.5rem] gap-4 border-b border-line px-4 py-2 text-label font-medium text-fg-secondary sm:grid"
          >
            <span>Arma</span>
            <span />
            <span className="text-right">Abates</span>
            <span className="text-right">HS% aprox.</span>
            <span className="text-right">Partidas</span>
          </div>
          <ul className="divide-y divide-line">
            {weapons.map((weapon) => (
              <WeaponRow key={weapon.weaponId} weapon={weapon} share={weapon.kills / top} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function WeaponRow({ weapon, share }: { weapon: WeaponMetric; share: number }) {
  const icon = weaponIconUrl(weapon.weaponId);
  const hs = weapon.hsRate === null ? "—" : formatPercent(weapon.hsRate, 1);
  return (
    <li className="num grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-4 py-3 sm:grid-cols-[8rem_minmax(0,1fr)_5rem_5.5rem_4.5rem]">
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="flex h-7 items-center">
          {icon ? (
            // eslint-disable-next-line @next/next/no-img-element -- community weapon asset
            <img src={icon} alt="" width={112} height={28} loading="lazy" className="h-full w-auto max-w-28 object-contain opacity-90" />
          ) : null}
        </span>
        <span className="truncate font-medium text-fg">{weapon.weaponName}</span>
      </div>
      <span aria-hidden="true" className="col-span-2 row-start-2 block h-1 overflow-hidden rounded-full bg-surface-3 sm:col-span-1 sm:row-start-1 sm:col-start-2">
        <span className="block h-full rounded-full bg-fg-secondary" style={{ width: `${Math.max(2, share * 100)}%` }} />
      </span>
      {/* Phone: one block with every number; from sm up, one column each. */}
      <span className="flex flex-col items-end gap-0.5 sm:hidden">
        <span className="stat text-[22px] leading-none font-semibold text-fg">{formatNumber(weapon.kills)}<span className="ml-1 font-sans text-label font-normal text-fg-muted">abates</span></span>
        <span className="text-label text-fg-secondary">
          HS {hs} · {weapon.matches} {weapon.matches === 1 ? "partida" : "partidas"}
        </span>
      </span>
      <span className="stat hidden text-right text-[22px] leading-none font-semibold text-fg sm:block">
        {formatNumber(weapon.kills)}
        <span className="sr-only"> abates</span>
      </span>
      <span className="hidden text-right text-table text-fg-secondary sm:block" title={`${weapon.shots} tiros em ${weapon.shotSampleRounds} rounds`}>
        {hs}
        <span className="sr-only"> de headshot, aproximado</span>
      </span>
      <span className="hidden text-right text-table text-fg-secondary sm:block">
        {weapon.matches}
        <span className="sr-only"> {weapon.matches === 1 ? "partida" : "partidas"}</span>
      </span>
    </li>
  );
}
