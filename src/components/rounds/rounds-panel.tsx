import { Crosshair, Layers3 } from "lucide-react";

import { mapThumbUrl } from "@/lib/assets";
import { formatNumber, formatPercent } from "@/lib/format";
import {
  clutchTone,
  clutchTotalTone,
  economyTone,
  kastTone,
  openingTone,
  sideTone,
  type PlayerRoundMetrics,
  type RateMetric,
  type SideMetric,
  type Tone,
} from "@/lib/rounds";

import { RateBar, ToneValue } from "./tone-value";

const rateText = (metric: RateMetric) => (metric.value === null ? "—" : formatPercent(metric.value, 1));
const sampleText = (sample: number) => `${formatNumber(sample)} ${sample === 1 ? "round" : "rounds"}`;
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

/**
 * Round breakdown (SPEC §7). Values that read as good or bad carry the
 * win/loss colour with ▲/▼; small samples stay neutral. The references are
 * spelled out in the footer.
 */
export function RoundsPanel({ metrics }: { metrics: PlayerRoundMetrics }) {
  if (metrics.rounds === 0) {
    return (
      <section aria-labelledby="rounds-title" className="rounded-card bg-surface-1 px-4 py-5 shadow-hairline">
        <h2 id="rounds-title" className="text-body-sm font-semibold text-fg">Rounds</h2>
        <p className="mt-1 text-fg-secondary">Os detalhes chegam quando o backfill processar as partidas deste filtro.</p>
      </section>
    );
  }

  const spots = ([1, 2, 3, 4, 5] as const).map((x) => ({ x, ...metrics.clutch[x] }));
  const clutchSituations = spots.reduce((sum, s) => sum + s.situations, 0);
  const clutchWins = spots.reduce((sum, s) => sum + s.wins, 0);
  const opening = openingTone(metrics.firstBlood, metrics.firstDeath);
  const openingDiff = metrics.firstBlood.successes - metrics.firstDeath.successes;

  return (
    <section aria-labelledby="rounds-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h2 id="rounds-title" className="text-body-sm font-semibold text-fg">Rounds</h2>
          <p className="num text-label font-normal text-fg-muted">Métricas calculadas de {sampleText(metrics.rounds)}</p>
        </div>
        <Crosshair aria-hidden="true" className="size-4 text-fg-muted" />
      </header>

      <dl className="grid grid-cols-2 gap-px border-b border-line bg-line lg:grid-cols-4">
        <Metric
          label="First blood"
          tone={opening}
          value={rateText(metrics.firstBlood)}
          detail={`${formatNumber(metrics.firstBlood.successes)} abates de abertura`}
        />
        <Metric
          label="First death"
          tone="neutral"
          value={rateText(metrics.firstDeath)}
          detail={`${formatNumber(metrics.firstDeath.successes)} mortes · saldo ${signed(openingDiff)}`}
        />
        <Metric label="KAST" tone={kastTone(metrics.kast)} value={rateText(metrics.kast)} detail="referência: 70%" />
        <Metric
          label="Clutches"
          tone={clutchTotalTone(metrics.clutch)}
          value={`${clutchWins}/${clutchSituations}`}
          detail={clutchSituations > 0 ? `${formatPercent(clutchWins / clutchSituations, 0)} vencidos` : "nenhuma situação"}
        />
      </dl>

      <div className="grid lg:grid-cols-3">
        <div className="flex flex-col gap-5 border-b border-line p-4 lg:border-r lg:border-b-0">
          <div>
            <h3 className="text-label font-medium text-fg-secondary">Multi-kills</h3>
            <div className="num mt-3 grid grid-cols-3 gap-3">
              <SmallStat label="3K" value={metrics.multiKills.three} />
              <SmallStat label="4K" value={metrics.multiKills.four} />
              <SmallStat label="Ace" value={metrics.multiKills.ace} />
            </div>
          </div>
          <div>
            <h3 className="text-label font-medium text-fg-secondary">Clutch por situação</h3>
            <ul className="num mt-2 flex flex-col gap-2">
              {spots.map((s) => {
                const tone = clutchTone(s.x, s);
                return (
                  <li key={s.x} className="grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 text-table">
                    <span className="font-medium text-fg">1v{s.x}</span>
                    <RateBar value={s.rate} tone={tone} />
                    <span className="min-w-20 text-right text-fg-secondary">
                      {s.situations === 0 ? (
                        <span className="text-fg-muted">—</span>
                      ) : (
                        <>
                          <ToneValue tone={tone}>{formatPercent(s.rate ?? 0, 0)}</ToneValue>{" "}
                          <span className="text-fg-muted">
                            {s.wins}/{s.situations}
                          </span>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>

        <div className="border-b border-line p-4 lg:border-r lg:border-b-0">
          <h3 className="text-label font-medium text-fg-secondary">Economia</h3>
          {metrics.economy.length > 0 ? (
            <ul className="num mt-2 flex flex-col">
              {metrics.economy.map((entry) => {
                const tone = economyTone(entry);
                return (
                  <li key={entry.band} className="flex flex-col gap-1.5 border-t border-line py-2.5 first:border-t-0">
                    <div className="flex items-baseline justify-between gap-3 text-table">
                      <span className="text-fg">{ECONOMY_LABEL[entry.band]}</span>
                      <span className="flex items-baseline gap-3">
                        <span className="text-fg-secondary">
                          {entry.winRate === null ? "—" : <ToneValue tone={tone}>{formatPercent(entry.winRate, 0)}</ToneValue>}
                          <span className="text-fg-muted"> · {entry.rounds}r</span>
                        </span>
                        <span className="w-14 text-right text-fg-secondary" title={`${entry.acsSample} rounds com score`}>
                          {entry.acs === null ? "—" : formatNumber(entry.acs)} <span className="text-label text-fg-muted">ACS</span>
                        </span>
                      </span>
                    </div>
                    <RateBar value={entry.winRate} tone={tone} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 text-label font-normal text-fg-muted">Sem rounds com economia completa neste filtro.</p>
          )}
        </div>

        <div className="p-4">
          <h3 className="text-label font-medium text-fg-secondary">Ataque × defesa</h3>
          {metrics.sides.length > 0 ? (
            <ul className="mt-2 flex flex-col gap-1.5">
              {metrics.sides.map((side) => (
                <SideRow key={side.mapName} side={side} />
              ))}
            </ul>
          ) : (
            <p className="mt-2 flex gap-2 text-label font-normal text-fg-muted">
              <Layers3 aria-hidden="true" className="size-4" /> Sem lado conhecido neste filtro.
            </p>
          )}
        </div>
      </div>

      <p className="border-t border-line px-4 py-3 text-label font-normal text-fg-muted">
        ▲ ▼ comparam com uma referência aproximada: 50% em cada lado, KAST de 70%, a taxa típica de cada clutch e de cada compra. Amostras pequenas ficam sem cor.
      </p>
    </section>
  );
}

function SideRow({ side }: { side: SideMetric }) {
  const thumb = mapThumbUrl(side.mapId);
  return (
    <li className="relative isolate flex items-center gap-3 overflow-hidden rounded-control bg-surface-2 px-3 py-2">
      {thumb ? (
        <span aria-hidden="true" className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${thumb})` }} />
      ) : null}
      <span aria-hidden="true" className="absolute inset-0 -z-10 bg-surface-0/85" />
      <span className="min-w-0 flex-1 truncate font-medium text-fg">{side.mapName}</span>
      <SideRate label="ATQ" title="no ataque" metric={side.attack} />
      <SideRate label="DEF" title="na defesa" metric={side.defense} />
    </li>
  );
}

function SideRate({ label, title, metric }: { label: string; title: string; metric: RateMetric }) {
  return (
    <span className="num flex w-[4.75rem] flex-col items-end text-table" title={`${sampleText(metric.sample)} ${title}`}>
      <span className="text-eyebrow text-fg-secondary">{label}</span>
      {metric.value === null ? <span className="text-fg-muted">—</span> : <ToneValue tone={sideTone(metric)} className="font-medium">{rateText(metric)}</ToneValue>}
    </span>
  );
}

function Metric({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: Tone;
}) {
  return (
    <div className="bg-surface-1 p-4">
      <dt className="text-label font-medium text-fg-secondary">{label}</dt>
      <dd className="stat num mt-1 text-[28px] leading-none font-semibold">
        <ToneValue tone={tone}>{value}</ToneValue>
      </dd>
      <dd className="num mt-1 text-label font-normal text-fg-muted">{detail}</dd>
    </div>
  );
}

function SmallStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="stat text-[24px] leading-none font-semibold text-fg">{value}</span>
      <span className="text-label text-fg-muted">{label}</span>
    </div>
  );
}

const ECONOMY_LABEL = { pistol: "Pistol", eco: "Eco", force: "Parcial / force", full: "Completa" } as const;
