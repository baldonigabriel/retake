import { Avatar } from "@/components/layout/account-menu";
import { AgentAvatar } from "@/components/match/agent-avatar";
import { Badge } from "@/components/ui/badge";
import { agentIconUrl } from "@/lib/assets";
import { formatNumber, formatPercent } from "@/lib/format";
import { COMPARE_LABEL, SMALL_SAMPLE, type CompareMetric, type CompareRow, type Comparison, type Side } from "@/lib/groups/compare";
import { cn } from "@/lib/utils";

function format(metric: CompareMetric, value: number | null): string {
  if (value === null) return "—";
  switch (metric) {
    case "acs":
    case "adr":
      return formatNumber(Math.round(value));
    case "kd":
      return formatNumber(value, 2);
    case "hs":
    case "winrate":
      return formatPercent(value, 0);
  }
}

const HINT: Record<CompareMetric, string> = {
  acs: "pontuação média por round",
  kd: "abates por morte",
  hs: "tiros na cabeça",
  adr: "dano médio por round",
  winrate: "partidas vencidas",
};

function Identity({ side, align }: { side: Side; align: "left" | "right" }) {
  const { member, summary } = side;
  return (
    <div className={cn("flex min-w-0 items-center gap-2.5", align === "right" && "flex-row-reverse text-right")}>
      <Avatar name={member.name} image={member.image} className="size-9 shrink-0 sm:size-10" />
      <div className={cn("flex min-w-0 flex-col gap-0.5", align === "right" && "items-end")}>
        <p className="flex min-w-0 items-baseline gap-1">
          <span className="truncate font-medium text-fg">{member.name}</span>
          {member.isYou ? <span className="sr-only"> (você)</span> : null}
        </p>
        <p className="num flex flex-wrap items-center gap-1.5 text-label font-normal text-fg-muted">
          <span className="hidden font-mono sm:inline">#{member.tag}</span>
          <span>
            {summary.matches} {summary.matches === 1 ? "partida" : "partidas"}
          </span>
          {member.isYou ? <Badge variant="outline">você</Badge> : null}
        </p>
      </div>
    </div>
  );
}

/**
 * One metric: values mirrored around the label, each with a bar scaled to
 * the larger of the two. The leader is brighter AND has the longer bar, and
 * screen readers hear who is ahead: colour never carries it alone.
 * Bars don't animate: switching players or filters happens all the time.
 */
function MetricRow({ row, nameA, nameB }: { row: CompareRow; nameA: string; nameB: string }) {
  const max = Math.max(row.a ?? 0, row.b ?? 0);
  const width = (v: number | null) => (v === null || max <= 0 ? 0 : Math.max(2, (v / max) * 100));
  const ahead = row.leader === "a" ? nameA : row.leader === "b" ? nameB : null;
  return (
    <div className="grid grid-cols-[1fr_64px_1fr] items-center gap-3 border-t border-line px-4 py-3 sm:grid-cols-[1fr_96px_1fr] sm:px-5">
      <div className="flex min-w-0 flex-col items-end gap-1.5">
        {/* Visible numbers are hidden from screen readers: the label column reads the whole row once. */}
        <span aria-hidden="true" className={cn("stat text-[28px] leading-none font-semibold", row.leader === "a" ? "text-fg" : "text-fg-muted")}>
          {format(row.metric, row.a)}
        </span>
        <span aria-hidden="true" className="flex h-1.5 w-full justify-end overflow-hidden rounded-full bg-surface-2">
          <span className={cn("h-full rounded-full", row.leader === "b" ? "bg-primary/45" : "bg-primary")} style={{ width: `${width(row.a)}%` }} />
        </span>
      </div>
      <div className="flex flex-col items-center gap-0.5 text-center">
        <span aria-hidden="true" className="text-eyebrow text-fg-secondary uppercase" title={HINT[row.metric]}>
          {COMPARE_LABEL[row.metric]}
        </span>
        <span className="sr-only">
          {COMPARE_LABEL[row.metric]}: {nameA} {format(row.metric, row.a)}, {nameB} {format(row.metric, row.b)}.{" "}
          {ahead ? `${ahead} na frente.` : row.a !== null && row.b !== null ? "Empate." : ""}
        </span>
      </div>
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        <span aria-hidden="true" className={cn("stat text-[28px] leading-none font-semibold", row.leader === "b" ? "text-fg" : "text-fg-muted")}>
          {format(row.metric, row.b)}
        </span>
        <span aria-hidden="true" className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <span className={cn("h-full rounded-full", row.leader === "a" ? "bg-paper/40" : "bg-paper")} style={{ width: `${width(row.b)}%` }} />
        </span>
      </div>
    </div>
  );
}

function TopAgent({ side, align }: { side: Side; align: "left" | "right" }) {
  if (!side.topAgent) return <span className={cn("text-fg-muted", align === "right" && "text-left")}>—</span>;
  return (
    <span className={cn("flex min-w-0 items-center gap-2", align === "left" && "flex-row-reverse")}>
      <AgentAvatar agent={side.topAgent.name} src={agentIconUrl(side.topAgent.id)} size={24} />
      <span className="truncate text-fg-secondary">{side.topAgent.name}</span>
    </span>
  );
}

export function CompareCard({ comparison }: { comparison: Comparison }) {
  const { a, b, rows } = comparison;
  const small = [a, b].filter((s) => s.summary.matches > 0 && s.summary.matches < SMALL_SAMPLE);
  const missing = [a, b].filter((s) => s.summary.matches === 0);
  return (
    <section aria-label={`${a.member.name} contra ${b.member.name}`} className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 py-4 sm:px-5">
        <Identity side={a} align="left" />
        <span aria-hidden="true" className="stat text-[18px] font-semibold text-fg-muted uppercase">
          vs
        </span>
        <Identity side={b} align="right" />
      </header>

      {rows.map((row) => (
        <MetricRow key={row.metric} row={row} nameA={a.member.name} nameB={b.member.name} />
      ))}

      <div className="grid grid-cols-[1fr_64px_1fr] items-center gap-3 border-t border-line px-4 py-3 sm:grid-cols-[1fr_96px_1fr] sm:px-5">
        <span className="flex justify-end">
          <TopAgent side={a} align="left" />
        </span>
        <span className="text-center text-eyebrow text-fg-secondary uppercase">Mais jogado</span>
        <TopAgent side={b} align="right" />
      </div>

      {missing.length > 0 || small.length > 0 ? (
        <p className="border-t border-line px-4 py-3 text-label font-normal text-fg-muted sm:px-5">
          {missing.length > 0
            ? `${missing.map((s) => s.member.name).join(" e ")} não ${missing.length > 1 ? "têm" : "tem"} partidas nesse recorte. Troque o período ou o modo.`
            : `Amostra pequena para ${small.map((s) => s.member.name).join(" e ")} (menos de ${SMALL_SAMPLE} partidas): compare com cuidado.`}
        </p>
      ) : null}
    </section>
  );
}
