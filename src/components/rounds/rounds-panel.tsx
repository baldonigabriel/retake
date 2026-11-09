import { Crosshair, Layers3 } from "lucide-react";

import { formatNumber, formatPercent } from "@/lib/format";
import type { PlayerRoundMetrics, RateMetric } from "@/lib/rounds";

const rateText = (metric: RateMetric) => (metric.value === null ? "—" : formatPercent(metric.value, 1));
const sampleText = (sample: number) => `${sample} ${sample === 1 ? "round" : "rounds"}`;

export function RoundsPanel({ metrics }: { metrics: PlayerRoundMetrics }) {
  if (metrics.rounds === 0) {
    return (
      <section aria-labelledby="rounds-title" className="rounded-card bg-surface-1 px-4 py-5 shadow-hairline">
        <h2 id="rounds-title" className="text-body-sm font-semibold text-fg">Rounds</h2>
        <p className="mt-1 text-fg-secondary">Os detalhes chegam quando o backfill processar as partidas deste filtro.</p>
      </section>
    );
  }

  const clutchSituations = Object.values(metrics.clutch).reduce((sum, value) => sum + value.situations, 0);
  const clutchWins = Object.values(metrics.clutch).reduce((sum, value) => sum + value.wins, 0);
  return (
    <section aria-labelledby="rounds-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="rounds-title" className="text-body-sm font-semibold text-fg">Rounds</h2>
          <p className="text-label font-normal text-fg-muted">Métricas calculadas de {sampleText(metrics.rounds)}</p>
        </div>
        <Crosshair aria-hidden="true" className="size-4 text-fg-muted" />
      </header>

      <dl className="grid grid-cols-2 border-b border-line sm:grid-cols-4">
        <Metric label="First blood" value={`${metrics.firstBlood.successes} · ${rateText(metrics.firstBlood)}`} sample={metrics.firstBlood.sample} />
        <Metric label="First death" value={`${metrics.firstDeath.successes} · ${rateText(metrics.firstDeath)}`} sample={metrics.firstDeath.sample} />
        <Metric label="KAST" value={rateText(metrics.kast)} sample={metrics.kast.sample} />
        <Metric label="Clutches" value={`${clutchWins}/${clutchSituations}`} sample={clutchSituations} />
      </dl>

      <div className="grid lg:grid-cols-3">
        <div className="border-b border-line p-4 lg:border-r lg:border-b-0">
          <h3 className="text-label font-medium text-fg-secondary">Multi-kills</h3>
          <div className="num mt-3 grid grid-cols-3 gap-3">
            <SmallStat label="3K" value={metrics.multiKills.three} />
            <SmallStat label="4K" value={metrics.multiKills.four} />
            <SmallStat label="Ás" value={metrics.multiKills.ace} />
          </div>
          <h3 className="mt-5 text-label font-medium text-fg-secondary">Clutch por situação</h3>
          <div className="num mt-2 flex flex-wrap gap-2">
            {Object.entries(metrics.clutch).map(([x, value]) => (
              <span key={x} className="rounded-chip bg-surface-3 px-2 py-1 text-label text-fg-secondary">
                1v{x}: <strong className="font-medium text-fg">{value.wins}/{value.situations}</strong>
              </span>
            ))}
          </div>
        </div>

        <div className="border-b border-line p-4 lg:border-r lg:border-b-0">
          <h3 className="text-label font-medium text-fg-secondary">Economia</h3>
          {metrics.economy.length > 0 ? (
            <div className="mt-2 overflow-x-auto">
              <table className="num w-full text-table">
                <thead><tr className="text-fg-muted"><th className="py-1 text-left font-medium">Compra</th><th className="py-1 text-right font-medium">Vitórias</th><th className="py-1 text-right font-medium">ACS</th></tr></thead>
                <tbody>
                  {metrics.economy.map((entry) => (
                    <tr key={entry.band} className="border-t border-line">
                      <th className="py-2 text-left font-normal text-fg">{ECONOMY_LABEL[entry.band]}</th>
                      <td className="py-2 text-right text-fg-secondary">{entry.winRate === null ? "—" : formatPercent(entry.winRate, 0)} <span className="text-fg-muted">· {entry.rounds}r</span></td>
                      <td className="py-2 text-right text-fg-secondary" title={`${entry.acsSample} rounds com score`}>{entry.acs === null ? "—" : formatNumber(entry.acs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="mt-2 text-label font-normal text-fg-muted">Sem rounds com economia completa neste filtro.</p>}
        </div>

        <div className="p-4">
          <h3 className="text-label font-medium text-fg-secondary">Ataque × defesa</h3>
          {metrics.sides.length > 0 ? (
            <ul className="mt-2 divide-y divide-line">
              {metrics.sides.map((side) => (
                <li key={side.mapName} className="num grid grid-cols-[1fr_auto_auto] gap-3 py-2 text-table">
                  <span className="truncate text-fg">{side.mapName}</span>
                  <span className="text-right text-fg-secondary" title={`${sampleText(side.attack.sample)} no ataque`}>ATQ {rateText(side.attack)}</span>
                  <span className="text-right text-fg-secondary" title={`${sampleText(side.defense.sample)} na defesa`}>DEF {rateText(side.defense)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex gap-2 text-label font-normal text-fg-muted"><Layers3 aria-hidden="true" className="size-4" /> Sem lado conhecido neste filtro.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value, sample }: { label: string; value: string; sample: number }) {
  return (
    <div className="border-r border-b border-line p-4 last:border-r-0 sm:border-b-0">
      <dt className="text-label font-medium text-fg-secondary">{label}</dt>
      <dd className="stat num mt-1 text-[28px] leading-none font-semibold text-fg">{value}</dd>
      <dd className="mt-1 text-label font-normal text-fg-muted">amostra: {sampleText(sample)}</dd>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return <div><span className="stat text-[24px] leading-none font-semibold text-fg">{value}</span><span className="ml-1 text-label text-fg-muted">{label}</span></div>;
}

const ECONOMY_LABEL = { pistol: "Pistol", eco: "Eco", force: "Parcial / force", full: "Completa" } as const;
