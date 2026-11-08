import { ChevronRight, CircleAlert, UsersRound } from "lucide-react";
import Link from "next/link";

import { RetryButton } from "@/components/goals/goal-buttons";
import { StaggerList } from "@/components/dashboard/stagger-list";
import { Avatar } from "@/components/layout/account-menu";
import { DeltaChip } from "@/components/stats/delta-chip";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { getPlayerLines } from "@/lib/dashboard/queries";
import { duoHeadline } from "@/lib/duos/display";
import { getMateAppearances, getMates, type Mate } from "@/lib/duos/queries";
import { formatNumber, formatPercent } from "@/lib/format";
import { modeAdjective, modeLabel } from "@/lib/modes";
import { ALL_MODES } from "@/lib/stats/aggregate";
import {
  SYNERGY_MIN_MATCHES,
  SYNERGY_RELIABLE_MATCHES,
  synergy,
  synergyTrend,
  type Duo,
  type SynergyLine,
} from "@/lib/stats/synergy";
import { cn } from "@/lib/utils";

const TITLE = "Com quem você joga melhor";

/** "competitivas", "sem classificação", "de mata-mata". */
function modeAdjectivePlural(mode: string): string {
  const adjective = modeAdjective(mode);
  return adjective.endsWith("a") && !adjective.startsWith("de ") ? `${adjective}s` : adjective;
}

function Shell({ aside, children }: { aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby="duos-title" className="content-enter overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex flex-col gap-0.5 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <h2 id="duos-title" className="text-body-sm font-semibold text-fg">
          {TITLE}
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

/** Same shape as the loaded panel: header, sentence, three rows. */
export function DuosPanelSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <Skeleton className="h-4 w-48" />
        <Skeleton className="hidden h-3 w-40 sm:block" />
      </div>
      <div className="border-b border-line px-4 py-3">
        <Skeleton className="h-4 w-full max-w-lg" />
      </div>
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="flex min-h-16 items-center gap-3 border-t border-line px-4 py-2 first:border-t-0">
          <Skeleton className="h-6 w-6" />
          <Skeleton className="size-8 rounded-full" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-44" />
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <Skeleton className="h-6 w-12" />
            <Skeleton className="h-3 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DuoRow({ duo, position, href }: { duo: Duo<Mate>; position: number; href: string }) {
  const { mate, summary } = duo;
  const trend = synergyTrend(duo.winRateDelta);
  const n = summary.matches;
  return (
    <li style={{ "--i": position - 1 } as React.CSSProperties} className="border-t border-line first:border-t-0">
      <Link
        href={href}
        aria-label={`${position}º, ${mate.name}: ${formatPercent(summary.winRate.rate, 0)} de vitórias em ${n} partidas juntos${
          duo.smallSample ? ", amostra pequena" : ""
        }. Ver as partidas.`}
        className="hover-layer press relative flex min-h-16 items-center gap-3 px-4 py-2 [--press-scale:0.99] focus-visible:outline-offset-[-2px]"
      >
        <span
          aria-hidden="true"
          className={cn("stat w-6 shrink-0 sm:w-7 text-[22px] leading-none font-bold", position <= 3 && !duo.smallSample ? "text-fg" : "text-fg-muted")}
        >
          {position}º
        </span>
        <Avatar name={mate.name} image={mate.image} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex min-w-0 items-baseline gap-1">
            <span className="truncate font-medium text-fg">{mate.name}</span>
            <span className="hidden font-mono text-label text-fg-muted sm:inline">#{mate.tag}</span>
          </span>
          <span className="num flex min-w-0 flex-wrap items-center gap-x-1.5 text-label font-normal text-fg-muted">
            <span className="whitespace-nowrap">
              {n} {n === 1 ? "partida" : "partidas"} juntos
            </span>
            <span aria-hidden="true">·</span>
            <span className="whitespace-nowrap">
              {summary.winRate.wins}V {summary.winRate.losses}D{summary.winRate.draws ? ` ${summary.winRate.draws}E` : ""}
            </span>
            <span aria-hidden="true" className="hidden sm:inline">
              ·
            </span>
            <span className="hidden sm:inline">
              K/D {formatNumber(summary.kd, 2)} · ACS {formatNumber(Math.round(summary.acs))}
            </span>
            {duo.smallSample ? (
              <span className="rounded-chip bg-surface-3 px-1.5 py-0.5 whitespace-nowrap text-fg-secondary">amostra pequena</span>
            ) : null}
          </span>
        </span>
        <span aria-hidden="true" className="flex shrink-0 flex-col items-end gap-0.5">
          <span className="stat text-[24px] leading-none font-semibold text-fg">{formatPercent(summary.winRate.rate, 0)}</span>
          {trend === "flat" ? (
            <span className="num text-label font-normal whitespace-nowrap text-fg-muted">≈ sua média</span>
          ) : (
            <span className="flex items-baseline gap-1 whitespace-nowrap">
              <DeltaChip value={duo.winRateDelta * 100} digits={0} suffix=" pts" />
              <span className="hidden text-label font-normal text-fg-muted sm:inline">vs. média</span>
            </span>
          )}
        </span>
        <ChevronRight aria-hidden="true" className="-mr-1 size-4 shrink-0 text-fg-muted" />
      </Link>
    </li>
  );
}

/**
 * "Com quem você joga melhor": the viewer's win rate on the same team as each
 * Retake user from their groups (or from one group), against their own
 * average in the mode. Only mates from shared groups; outsiders never.
 * Loads inside a Suspense boundary so a failure stays local.
 */
export async function DuosPanel({
  viewerId,
  viewerPuuid,
  lines,
  mode,
  groupId,
  scope,
  hrefFor,
}: {
  viewerId: string;
  viewerPuuid: string;
  /** The viewer's lines (already period-filtered on /me); loaded here when absent. */
  lines?: readonly SynergyLine[];
  mode: string;
  /** Only this group's members (group page). */
  groupId?: string;
  /** "dos seus grupos" / "deste grupo", for the empty state. */
  scope: "groups" | "group";
  hrefFor: (mate: Mate) => string;
}) {
  let result;
  let mates: Mate[];
  try {
    const [loadedMates, appearances, own] = await Promise.all([
      getMates(viewerId, groupId),
      getMateAppearances(viewerId, viewerPuuid, groupId),
      lines ?? getPlayerLines(viewerPuuid),
    ]);
    mates = loadedMates;
    result = synergy(
      viewerPuuid,
      own,
      mates.map((m) => ({ puuid: m.puuid, mate: m, appearances: appearances.get(m.puuid) ?? [] })),
      { mode },
    );
  } catch (error) {
    console.error("[duos] load failed", error);
    return (
      <Shell>
        <ErrorState
          icon={CircleAlert}
          title="Não conseguimos carregar seus duos"
          description="O resto da página continua certo. Tente de novo em alguns segundos."
          action={<RetryButton />}
        />
      </Shell>
    );
  }

  const { baseline, duos, tooFew } = result;
  const aside = (
    <span className="num text-label font-normal text-fg-muted">
      {modeLabel(mode)} · mesmo time · sua média {formatPercent(baseline.winRate.rate, 0)}
    </span>
  );

  if (mates.length === 0) {
    return (
      <Shell>
        <EmptyState
          icon={UsersRound}
          title={scope === "group" ? "Ninguém mais do grupo tem Riot ID vinculado" : "Nenhum amigo do Retake nos seus grupos ainda"}
          description="Aqui só aparece quem usa o Retake e está num grupo com você. Chame seu duo para um grupo e, depois de algumas partidas juntos, a comparação aparece aqui."
          action={
            scope === "groups" ? (
              <Link href="/groups" className={buttonVariants({ variant: "ghost" })}>
                Ver meus grupos
              </Link>
            ) : undefined
          }
        />
      </Shell>
    );
  }

  if (duos.length === 0) {
    const closest = tooFew[0];
    return (
      <Shell aside={aside}>
        <EmptyState
          icon={UsersRound}
          title={`Ainda faltam partidas ${mode === ALL_MODES ? "" : `${modeAdjectivePlural(mode)} `}juntos`}
          description={
            closest
              ? `A comparação começa com ${SYNERGY_MIN_MATCHES} partidas no mesmo time. Com ${closest.mate.name} vocês têm ${closest.matches} de ${SYNERGY_MIN_MATCHES}.`
              : `A comparação começa com ${SYNERGY_MIN_MATCHES} partidas no mesmo time com alguém dos seus grupos. Joguem juntos e ela aparece aqui.`
          }
        />
      </Shell>
    );
  }

  return (
    <Shell aside={aside}>
      <p className="border-b border-line px-4 py-3 text-fg">{duoHeadline(duos[0]!)}</p>
      <StaggerList ordered aria-label={TITLE}>
        {duos.map((duo, i) => (
          <DuoRow key={duo.puuid} duo={duo} position={i + 1} href={hrefFor(duo.mate)} />
        ))}
      </StaggerList>
      <p className="border-t border-line px-4 py-3 text-label font-normal text-fg-muted">
        Tendência das partidas no mesmo time, não regra. Com menos de {SYNERGY_RELIABLE_MATCHES} partidas juntos, a dupla
        aparece depois e marcada como amostra pequena.
        {tooFew.length > 0
          ? ` Ainda sem partidas suficientes: ${tooFew.map((t) => `${t.mate.name} (${t.matches})`).join(", ")}.`
          : ""}
      </p>
    </Shell>
  );
}
