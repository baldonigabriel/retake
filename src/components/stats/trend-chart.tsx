"use client";

import { useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { formatNumber } from "@/lib/format";

type MetricKey = "acs" | "kd" | "hs" | "adr";

const METRICS: readonly { value: MetricKey; label: string; digits: number; suffix?: string }[] = [
  { value: "acs", label: "ACS", digits: 0 },
  { value: "kd", label: "K/D", digits: 2 },
  { value: "hs", label: "HS%", digits: 1, suffix: "%" },
  { value: "adr", label: "ADR", digits: 0 },
];

const config = {
  value: { label: "Valor", color: "var(--chart-1)" },
} satisfies ChartConfig;

type Point = { match: number } & Record<MetricKey, number>;

/**
 * DESIGN.md › Gráfico de linha: 2px line, dots only on hover, gradient area
 * (accent 16% → 0), horizontal hairline grid, dashed average line, tooltip on
 * surface-3 with the value in Barlow. Switching metric does not animate.
 */
export function TrendChart({ data }: { data: readonly Point[] }) {
  const [metric, setMetric] = useState<MetricKey>("acs");
  const gradientId = `trend-fill-${useId().replace(/:/g, "")}`;
  const meta = METRICS.find((m) => m.value === metric) ?? METRICS[0]!;
  const values = data.map((d) => d[metric]);
  const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const fmt = (v: number) => `${formatNumber(v, meta.digits)}${meta.suffix ?? ""}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow text-fg-muted uppercase">Últimas {data.length} partidas</p>
          <p className="text-body-sm text-fg-secondary">
            Média{" "}
            <span className="stat text-[20px] leading-none font-semibold text-fg">{fmt(avg)}</span>
          </p>
        </div>
        <SegmentedControl label="Métrica do gráfico" options={METRICS} value={metric} onChange={setMetric} />
      </div>
      <ChartContainer
        config={config}
        className="aspect-auto h-56 w-full sm:h-64"
        role="img"
        aria-label={`Evolução de ${meta.label} nas últimas ${data.length} partidas, média ${fmt(avg)}`}
      >
        <AreaChart data={[...data]} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
          <XAxis dataKey="match" tickLine={false} axisLine={false} tickMargin={8} minTickGap={24} />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={44}
            domain={["auto", "auto"]}
            tickFormatter={(v: number) => formatNumber(v, meta.digits > 1 ? 1 : 0)}
          />
          <ReferenceLine y={avg} stroke="var(--chart-avg)" strokeDasharray="4 4" />
          <Tooltip
            cursor={{ stroke: "var(--color-line-strong)" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const point = payload?.[0];
              if (!active || !point) return null;
              return (
                <div className="flex flex-col gap-1 rounded-chip border border-line-strong bg-surface-3 px-2.5 py-2 shadow-pop">
                  <span className="text-eyebrow text-fg-muted uppercase">
                    Partida {String((point.payload as Point).match)}
                  </span>
                  <span className="stat text-[22px] leading-none font-semibold text-fg">
                    {fmt(Number(point.value))}
                  </span>
                </div>
              );
            }}
          />
          <Area
            dataKey={metric}
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 4, fill: "var(--chart-1)", stroke: "var(--color-surface-1)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
