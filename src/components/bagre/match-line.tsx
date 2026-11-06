import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { AgentAvatar } from "@/components/match/agent-avatar";
import { ResultChip } from "@/components/stats/result-chip";
import { agentIconUrl } from "@/lib/assets";
import { lineFacts, type NominatedLine } from "@/lib/bagre/display";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The nominee's line in one match: result (chip with letter), map, mode,
 * score, agent, K/D/A and ACS. The match page only opens for players in it,
 * so the link shows only when the viewer played (`href`).
 */
export function MatchLine({ line, href, className }: { line: NominatedLine; href?: string; className?: string }) {
  const f = lineFacts(line);
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-label font-normal text-fg-secondary", className)}>
      <ResultChip result={f.result} />
      <span className="flex min-w-0 items-center gap-1.5">
        <AgentAvatar agent={line.agentName ?? "Agente"} src={agentIconUrl(line.agentId)} size={24} />
        <span className="truncate text-fg">{f.map}</span>
      </span>
      <span className="num">
        {f.mode}
        {f.score ? ` · ${f.score}` : ""}
      </span>
      <span className="num font-mono text-fg">{f.kda}</span>
      <span className="num">ACS {formatNumber(f.acs)}</span>
      {href ? (
        <Link
          href={href}
          className="inline-flex min-h-11 items-center gap-0.5 text-fg-secondary underline decoration-line-strong underline-offset-4 hover:text-fg hover:decoration-fg sm:min-h-0"
        >
          Ver partida
          <ArrowUpRight aria-hidden="true" className="size-3.5" />
        </Link>
      ) : null}
    </div>
  );
}
