import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { AgentAvatar } from "@/components/match/agent-avatar";
import { ToneValue } from "@/components/rounds/tone-value";
import { agentIconUrl, mapThumbUrl, weaponIconUrl } from "@/lib/assets";
import { formatNumber, formatPercent } from "@/lib/format";
import { clutchTotalTone, kastTone, openingTone, type PlayerRoundMetrics, type WeaponMetric } from "@/lib/rounds";
import type { AgentStats } from "@/lib/stats/agents";
import type { GroupStats } from "@/lib/stats/breakdown";
import { OVERVIEW_MAP_MIN_MATCHES } from "@/lib/stats/overview";

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

/**
 * "Destaques" on the overview tab: the top 3 agents, the 3 most used weapons
 * with their (approximate) HS%, the best maps and the round numbers that
 * matter most. Each block links to the tab with everything.
 */
export function OverviewHighlights({
  agents,
  weapons,
  maps,
  rounds,
  hrefs,
  agentHref,
}: {
  agents: readonly AgentStats[];
  weapons: readonly WeaponMetric[];
  maps: readonly GroupStats[];
  rounds: PlayerRoundMetrics;
  hrefs: { agents: string; combat: string; maps: string };
  agentHref?: (a: AgentStats) => string | null;
}) {
  const clutchSituations = ([1, 2, 3, 4, 5] as const).reduce((sum, x) => sum + rounds.clutch[x].situations, 0);
  const clutchWins = ([1, 2, 3, 4, 5] as const).reduce((sum, x) => sum + rounds.clutch[x].wins, 0);
  return (
    <section aria-labelledby="highlights-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="border-b border-line px-4 py-3">
        <h2 id="highlights-title" className="text-body-sm font-semibold text-fg">
          Destaques
        </h2>
      </header>
      <div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-4">
        <Block title="Agentes mais jogados" href={hrefs.agents} more="Ver agentes">
          {agents.length === 0 ? (
            <Empty>Nenhum agente nessa seleção.</Empty>
          ) : (
            agents.slice(0, 3).map((a) => {
              const href = agentHref?.(a) ?? null;
              const name = <span className="truncate font-medium text-fg">{a.agentName}</span>;
              // The whole row opens the agent page (a 44px target on phones).
              const row = (
                <Row key={a.key}>
                  <AgentAvatar agent={a.agentName} src={agentIconUrl(a.agentId)} size={28} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    {name}
                    <span className="num text-label font-normal text-fg-muted">{plural(a.matches, "partida", "partidas")}</span>
                  </span>
                  <Figure value={formatPercent(a.winRate, 0)} label="vitórias" />
                  <Figure value={formatNumber(Math.round(a.acs))} label="ACS" />
                </Row>
              );
              return href ? (
                <Link key={a.key} href={href} className="hover-layer press relative -mx-2 rounded-control px-2 [--press-scale:0.99]">
                  {row}
                </Link>
              ) : (
                row
              );
            })
          )}
        </Block>

        <Block title="Armas mais usadas" href={hrefs.combat} more="Ver armas" note="HS% aproximado">
          {weapons.length === 0 ? (
            <Empty>Sem amostra de armas nessa seleção.</Empty>
          ) : (
            weapons.slice(0, 3).map((w) => {
              const icon = weaponIconUrl(w.weaponId);
              return (
                <Row key={w.weaponId}>
                  <span className="flex h-7 w-16 shrink-0 items-center">
                    {icon ? (
                      // eslint-disable-next-line @next/next/no-img-element -- community weapon asset
                      <img src={icon} alt="" width={64} height={16} loading="lazy" className="max-h-4 w-auto max-w-16 object-contain opacity-90" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-fg">{w.weaponName}</span>
                    <span className="num text-label font-normal text-fg-muted">{plural(w.kills, "abate", "abates")}</span>
                  </span>
                  <Figure value={w.hsRate === null ? "—" : formatPercent(w.hsRate, 1)} label="HS%" />
                </Row>
              );
            })
          )}
        </Block>

        <Block title="Melhores mapas" href={hrefs.maps} more="Ver mapas">
          {maps.length === 0 ? (
            <Empty>Nenhum mapa com {OVERVIEW_MAP_MIN_MATCHES} partidas ainda.</Empty>
          ) : (
            maps.map((m) => {
              const thumb = mapThumbUrl(m.id);
              return (
                <Row key={m.key}>
                  <span className="relative h-7 w-12 shrink-0 overflow-hidden rounded-chip bg-surface-3">
                    {thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- community map asset
                      <img src={thumb} alt="" width={48} height={28} loading="lazy" className="size-full object-cover" />
                    ) : null}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium text-fg">{m.name}</span>
                    <span className="num text-label font-normal text-fg-muted">
                      {m.summary.winRate.wins}V {m.summary.winRate.losses}D{m.summary.winRate.draws ? ` ${m.summary.winRate.draws}E` : ""}
                    </span>
                  </span>
                  <Figure value={formatPercent(m.summary.winRate.rate, 0)} label="vitórias" />
                </Row>
              );
            })
          )}
        </Block>

        <Block title="Rounds" href={hrefs.combat} more="Ver rounds">
          {rounds.rounds === 0 ? (
            <Empty>Os detalhes chegam quando o backfill processar essas partidas.</Empty>
          ) : (
            <dl className="num grid grid-cols-2 gap-x-3 gap-y-3 py-1">
              <RoundStat label="KAST">
                <ToneValue tone={kastTone(rounds.kast)}>{rounds.kast.value === null ? "—" : formatPercent(rounds.kast.value, 0)}</ToneValue>
              </RoundStat>
              <RoundStat label="FB − FD">
                <ToneValue tone={openingTone(rounds.firstBlood, rounds.firstDeath)}>
                  {signed(rounds.firstBlood.successes - rounds.firstDeath.successes)}
                </ToneValue>
              </RoundStat>
              <RoundStat label="Clutches">
                <ToneValue tone={clutchTotalTone(rounds.clutch)}>
                  {clutchWins}/{clutchSituations}
                </ToneValue>
              </RoundStat>
              <RoundStat label="Aces">
                <span className="text-fg">{rounds.multiKills.ace}</span>
              </RoundStat>
            </dl>
          )}
        </Block>
      </div>
    </section>
  );
}

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");

function Block({
  title,
  href,
  more,
  note,
  children,
}: {
  title: string;
  href: string;
  more: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 bg-surface-1 p-4">
      <h3 className="flex items-baseline justify-between gap-2 text-label font-medium text-fg-secondary">
        {title}
        {note ? <span className="font-normal text-fg-muted">{note}</span> : null}
      </h3>
      <div className="flex flex-1 flex-col divide-y divide-line">{children}</div>
      <Link
        href={href}
        scroll={false}
        className="hover-layer press relative -mx-2 mt-1 inline-flex min-h-11 w-fit items-center gap-1 rounded-control px-2 text-label text-fg-secondary hover:text-fg focus-visible:text-fg sm:min-h-8"
      >
        {more}
        <ChevronRight aria-hidden="true" className="size-3.5" />
      </Link>
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-12 items-center gap-3 py-1.5">{children}</div>;
}

function Figure({ value, label }: { value: string; label: string }) {
  return (
    <span className="flex w-12 shrink-0 flex-col items-end">
      <span className="stat num text-[20px] leading-none font-semibold text-fg">{value}</span>
      <span className="text-eyebrow text-fg-muted uppercase">{label}</span>
    </span>
  );
}

function RoundStat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-eyebrow text-fg-muted uppercase">{label}</dt>
      <dd className="stat text-[24px] leading-none font-semibold">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-2 text-label font-normal text-fg-muted">{children}</p>;
}
