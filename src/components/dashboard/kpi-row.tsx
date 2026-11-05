import { KpiCard } from "@/components/stats/kpi-card";
import { formatNumber, formatPercent } from "@/lib/format";
import type { RecentComparison, TrendPoint } from "@/lib/stats/breakdown";

/**
 * The five KPIs. Value = last N matches; delta = vs. the whole selection.
 * Formulas are in the hint (read by screen readers, shown on hover).
 */
export function KpiRow({ cmp, trend }: { cmp: RecentComparison; trend: readonly TrendPoint[] }) {
  const { recent, overall, comparable } = cmp;
  const delta = (a: number, b: number) => (comparable ? a - b : undefined);
  const note = `média de ${formatNumber(overall.matches)} ${overall.matches === 1 ? "partida" : "partidas"}`;
  const wr = recent.winRate;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <KpiCard
        label="ACS"
        hint="pontuação de combate por round"
        value={formatNumber(Math.round(recent.acs))}
        delta={delta(recent.acs, overall.acs)}
        deltaDigits={0}
        note={note}
        trend={trend.map((p) => p.acs)}
      />
      <KpiCard
        label="K/D"
        hint="abates por morte"
        value={formatNumber(recent.kd, 2)}
        delta={delta(recent.kd, overall.kd)}
        deltaDigits={2}
        note={note}
        trend={trend.map((p) => p.kd)}
      />
      <KpiCard
        label="HS%"
        hint="tiros na cabeça sobre todos os acertos"
        value={formatPercent(recent.hsRate)}
        delta={delta(recent.hsRate * 100, overall.hsRate * 100)}
        deltaDigits={1}
        deltaSuffix="p.p. vs. média"
        note={note}
        trend={trend.map((p) => p.hs)}
      />
      <KpiCard
        label="ADR"
        hint="dano por round"
        value={formatNumber(Math.round(recent.adr))}
        delta={delta(recent.adr, overall.adr)}
        deltaDigits={0}
        note={note}
        trend={trend.map((p) => p.adr)}
      />
      <KpiCard
        className="col-span-2 sm:col-span-1"
        label="Vitórias"
        hint={`${wr.wins} vitórias, ${wr.losses} derrotas, ${wr.draws} empates; empate não conta como vitória`}
        value={formatPercent(wr.rate, 0)}
        delta={delta(wr.rate * 100, overall.winRate.rate * 100)}
        deltaDigits={1}
        deltaSuffix="p.p. vs. média"
        note={`${wr.wins}V · ${wr.losses}D${wr.draws ? ` · ${wr.draws}E` : ""}`}
      />
    </div>
  );
}
