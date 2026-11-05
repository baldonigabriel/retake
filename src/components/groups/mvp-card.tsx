import { Trophy } from "lucide-react";

import { Avatar } from "@/components/layout/account-menu";
import { Badge } from "@/components/ui/badge";
import { ChamferCard } from "@/components/ui/chamfer-card";
import { formatNumber, formatPercent } from "@/lib/format";
import { MVP_MIN_MATCHES, MVP_RULE, type Mvp } from "@/lib/groups/ranking";

/**
 * DESIGN.md › Destaque de MVP: the screen's one chamfered card, accent tint +
 * soft red glow. The selection rule is always printed in one line.
 */
export function MvpCard({ mvp, weekLabel }: { mvp: Mvp | null; weekLabel: string }) {
  if (!mvp) {
    return (
      <ChamferCard>
        <section aria-labelledby="mvp-title" className="flex flex-col gap-3">
          <h2 id="mvp-title" className="flex items-center gap-2 text-eyebrow text-fg-muted uppercase">
            <Trophy aria-hidden="true" className="size-3.5" />
            MVP da semana · {weekLabel}
          </h2>
          <p className="font-medium text-fg">Ainda sem MVP</p>
          <p className="text-fg-secondary">
            Ninguém do grupo jogou {MVP_MIN_MATCHES} partidas competitivas nessa semana. Quem chegar lá primeiro já entra na
            disputa.
          </p>
          <p className="border-t border-line pt-3 text-label font-normal text-fg-muted">{MVP_RULE}</p>
        </section>
      </ChamferCard>
    );
  }

  const { member, summary } = mvp;
  return (
    <ChamferCard variant="mvp">
      <section aria-labelledby="mvp-title" className="flex flex-col gap-4">
        <h2 id="mvp-title" className="flex items-center gap-2 text-eyebrow text-fg-muted uppercase">
          <Trophy aria-hidden="true" className="size-3.5 text-primary" />
          MVP da semana · {weekLabel}
        </h2>
        <div className="flex items-center gap-3">
          <Avatar name={member.name} image={member.image} className="size-12 text-body-sm" />
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="flex min-w-0 items-baseline gap-1">
              <span className="truncate text-subheading text-fg">{member.name}</span>
              {member.tag ? <span className="font-mono text-label text-fg-muted">#{member.tag}</span> : null}
            </p>
            {member.isYou ? <Badge variant="accent" className="mt-1">é você!</Badge> : null}
          </div>
          <p className="flex shrink-0 flex-col items-end">
            <span className="stat text-stat-lg text-fg">{formatNumber(Math.round(summary.acs))}</span>
            <span className="text-eyebrow text-fg-muted uppercase">ACS</span>
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-3 border-t border-accent-line pt-3">
          {[
            ["K/D", formatNumber(summary.kd, 2)],
            ["Vitórias", formatPercent(summary.winRate.rate, 0)],
            ["Partidas", formatNumber(summary.matches)],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <dt className="text-label text-fg-muted">{label}</dt>
              <dd className="stat text-[24px] leading-none font-semibold text-fg">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-label font-normal text-fg-muted">{MVP_RULE}</p>
      </section>
    </ChamferCard>
  );
}
