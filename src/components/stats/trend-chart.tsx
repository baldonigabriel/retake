"use client";

import { use, useId, useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";

import { AgentAvatar } from "@/components/match/agent-avatar";
import { MotionScope } from "@/components/motion/motion-scope";
import { AnimatedNumber } from "@/components/stats/animated-number";
import { RESULT_LABEL } from "@/components/stats/result-chip";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { useMediaQuery } from "@/hooks/use-media-query";
import { agentIconUrl } from "@/lib/assets";
import { formatNumber } from "@/lib/format";
import type { TrendPoint } from "@/lib/stats/breakdown";

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

type Point = Pick<TrendPoint, "match" | MetricKey | "map" | "agent" | "agentId" | "result" | "own" | "enemy">;

/**
 * DESIGN.md › Gráfico de linha + Movimento › Gráficos: 2px line, dots only on
 * hover, gradient area, horizontal hairline grid, dashed average line.
 * - First render: the series is revealed left → right (a clip rect scaled on
 *   X, transform only, 300ms).
 * - Metric or filter change: the new series fades in with a 4px rise (200ms);
 *   a background refresh (same filters) just redraws.
 * - Hover: vertical guide, bigger active dot, tooltip with map, agent, result
 *   and value. On touch, tapping a point opens the tooltip.
 */
export function TrendChart({ data }: { data: readonly Point[] }) {
  const [metric, setMetric] = useState<MetricKey>("acs");
  const id = useId().replace(/:/g, "");
  const gradientId = `trend-fill-${id}`;
  const revealId = `trend-reveal-${id}`;
  const meta = METRICS.find((m) => m.value === metric) ?? METRICS[0]!;
  const values = data.map((d) => d[metric]);
  const avg = values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1);
  const fmt = (v: number) => `${formatNumber(v, meta.digits)}${meta.suffix ?? ""}`;
  const reduced = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Remount the series (and replay its swap fade) only when the user changes
  // what it shows: the metric here, or a filter in the URL.
  const seriesKey = `${use(MotionScope)}|${metric}`;
  const [series, setSeries] = useState({ key: seriesKey, swapped: false });
  if (series.key !== seriesKey) setSeries({ key: seriesKey, swapped: true });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-eyebrow text-fg-muted uppercase">Últimas {data.length} partidas</p>
          <p className="text-body-sm text-fg-secondary">
            Média{" "}
            <AnimatedNumber
              value={avg}
              digits={meta.digits}
              suffix={meta.suffix}
              kind={metric}
              className="stat text-[20px] leading-none font-semibold text-fg"
            />
          </p>
        </div>
        <SegmentedControl label="Métrica do gráfico" options={METRICS} value={metric} onChange={setMetric} />
      </div>
      <ChartContainer
        config={config}
        className="trend-chart aspect-auto h-56 w-full sm:h-64"
        style={{ "--trend-reveal": `url(#${revealId})` } as React.CSSProperties}
        role="img"
        aria-label={`Evolução de ${meta.label} nas últimas ${data.length} partidas, média ${fmt(avg)}`}
      >
        <AreaChart data={[...data]} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.16} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            {/* Scaled once from 0 to 1 on X when the chart first appears (CSS). */}
            <clipPath id={revealId}>
              <rect className="trend-reveal-rect" x="0" y="0" width="100%" height="100%" />
            </clipPath>
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
            trigger="hover"
            cursor={{ stroke: "var(--color-line-strong)", strokeWidth: 1 }}
            isAnimationActive={!reduced}
            animationDuration={150}
            animationEasing="ease-out"
            // Stay inside the chart: the panel clips anything past its edge,
            // so a low point flips the tooltip above the cursor instead.
            allowEscapeViewBox={{ x: false, y: false }}
            content={({ active, payload }) => {
              const point = payload?.[0];
              if (!active || !point) return null;
              return <TrendTooltip point={point.payload as Point} label={meta.label} value={fmt(Number(point.value))} />;
            }}
          />
          <Area
            key={series.key}
            className={series.swapped ? "trend-swap" : undefined}
            dataKey={metric}
            type="monotone"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={false}
            activeDot={{ r: 5, fill: "var(--chart-1)", stroke: "var(--color-surface-1)", strokeWidth: 2 }}
            isAnimationActive={false}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

const RESULT_BADGE = { win: "win", loss: "loss", draw: "draw" } as const;

/** DESIGN.md › Popover: surface-3, strong border, the only drop shadow; value in Barlow. */
function TrendTooltip({ point, label, value }: { point: Point; label: string; value: string }) {
  return (
    <div className="trend-tooltip flex min-w-44 flex-col gap-2 rounded-control border border-line-strong bg-surface-3 px-3 py-2.5 shadow-pop">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 flex-col">
          <span className="text-eyebrow text-fg-muted uppercase">Partida {point.match}</span>
          <span className="truncate text-body-sm font-medium text-fg">{point.map}</span>
        </span>
        <Badge variant={RESULT_BADGE[point.result]} className="num font-semibold">
          {RESULT_LABEL[point.result]} {point.own}–{point.enemy}
        </Badge>
      </div>
      <span className="flex items-center gap-2 text-label font-normal text-fg-secondary">
        <AgentAvatar agent={point.agent} src={agentIconUrl(point.agentId)} size={24} />
        {point.agent}
      </span>
      <span className="flex items-baseline justify-between gap-3 border-t border-line pt-2">
        <span className="text-eyebrow text-fg-muted uppercase">{label}</span>
        <span className="stat text-[22px] leading-none font-semibold text-fg">{value}</span>
      </span>
    </div>
  );
}
