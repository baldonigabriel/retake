import { Target } from "lucide-react";

import { formatPercent } from "@/lib/format";
import type { WeaponMetric } from "@/lib/rounds";
import { cn } from "@/lib/utils";

export function WeaponsPanel({ weapons }: { weapons: readonly WeaponMetric[] }) {
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
          <div className="hidden overflow-x-auto sm:block">
            <table className="num w-full text-table">
              <thead><tr className="text-fg-secondary"><th className="px-4 py-2 text-left font-medium">Arma</th><th className="px-3 py-2 text-right font-medium">Abates</th><th className="px-3 py-2 text-right font-medium">HS% aprox.</th><th className="px-4 py-2 text-right font-medium">Partidas</th></tr></thead>
              <tbody>
                {weapons.map((weapon) => <WeaponRow key={weapon.weaponId ?? weapon.weaponName} weapon={weapon} />)}
              </tbody>
            </table>
          </div>
          <ul className="divide-y divide-line sm:hidden">
            {weapons.map((weapon) => (
              <li key={weapon.weaponId ?? weapon.weaponName} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 px-4 py-3">
                <span className={cn("font-medium", weapon.prominent ? "text-fg" : "text-fg-secondary")}>{weapon.weaponName}</span>
                <span className={cn("stat num text-[22px] leading-none font-semibold", weapon.prominent ? "text-fg" : "text-fg-secondary")}>{weapon.kills} abates</span>
                <span className="num text-label text-fg-secondary">HS {weapon.hsRate === null ? "—" : formatPercent(weapon.hsRate, 1)}</span>
                <span className="num text-right text-label text-fg-muted">{weapon.matches} {weapon.matches === 1 ? "partida" : "partidas"}</span>
                {!weapon.prominent ? <span className="col-span-2 text-label text-fg-muted">Amostra pequena: menos de 10 abates e 100 tiros.</span> : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function WeaponRow({ weapon }: { weapon: WeaponMetric }) {
  return (
    <tr className="border-t border-line">
      <th className={cn("px-4 py-2 text-left font-normal", weapon.prominent ? "text-fg" : "text-fg-secondary")}>
        {weapon.weaponName}
        {!weapon.prominent ? <span className="ml-2 text-label text-fg-muted">amostra pequena</span> : null}
      </th>
      <td className="px-3 py-2 text-right text-fg-secondary">{weapon.kills}</td>
      <td className="px-3 py-2 text-right text-fg-secondary" title={`${weapon.shots} tiros em ${weapon.shotSampleRounds} rounds`}>
        {weapon.hsRate === null ? "—" : formatPercent(weapon.hsRate, 1)}
      </td>
      <td className="px-4 py-2 text-right text-fg-secondary">{weapon.matches}</td>
    </tr>
  );
}
