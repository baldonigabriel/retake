import { Settings, Swords, Trophy, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FilteredContent, FilterProvider } from "@/components/dashboard/dashboard-filters";
import { Avatar } from "@/components/layout/account-menu";
import { CopyInviteButton, LeaveGroupButton } from "@/components/groups/group-buttons";
import { GroupFilter } from "@/components/groups/group-filters";
import { MvpCard } from "@/components/groups/mvp-card";
import { RankingList } from "@/components/groups/ranking-list";
import { TogetherList } from "@/components/groups/together-list";
import { AnimatedNumber } from "@/components/stats/animated-number";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { requireViewer } from "@/lib/auth/session";
import { metricDelta, metricNumber, recordLine } from "@/lib/groups/display";
import { getGroupMembers, getMemberLines, getMembership, getTogetherLines } from "@/lib/groups/queries";
import {
  DEFAULT_METRIC,
  METRIC_LABEL,
  RANKING_METRICS,
  buildRanking,
  parseMetric,
  togetherMatches,
  weekModes,
  weekMvp,
} from "@/lib/groups/ranking";
import { formatWeek, parseWeek, previousWeek, weekRange } from "@/lib/groups/week";
import { modeAdjective, modeLabel } from "@/lib/modes";
import { ALL_MODES, DEFAULT_MODE } from "@/lib/stats/aggregate";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Grupo",
  description: "Ranking da semana, MVP e partidas que vocês jogaram juntos.",
  robots: { index: false, follow: false },
};

const WEEK_OPTIONS = [
  { value: "current", label: "Esta semana" },
  { value: "last", label: "Semana passada" },
] as const;

/** Question this screen answers: "quem mandou bem essa semana?" */
export default async function GroupPage({ params, searchParams }: PageProps<"/groups/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { user } = await requireViewer(`/groups/${slug}`);
  // Non-members get exactly what a missing group gets: 404.
  const membership = await getMembership(slug, user.id);
  if (!membership) notFound();
  const { group, role } = membership;

  const now = new Date();
  const weekChoice = parseWeek(query.week);
  const thisWeek = weekRange(now);
  const week = weekChoice === "last" ? previousWeek(thisWeek) : thisWeek;
  const before = previousWeek(week);

  const members = await getGroupMembers(group.id, user.id);
  const puuids = members.flatMap((m) => (m.puuid ? [m.puuid] : []));
  const [lines, togetherLines] = await Promise.all([
    getMemberLines(puuids, before.start, week.end),
    getTogetherLines(puuids),
  ]);

  const modes = weekModes(lines, week);
  const mode = typeof query.mode === "string" && modes.includes(query.mode) ? query.mode : DEFAULT_MODE;
  const metric = parseMetric(query.metric);
  const ranking = buildRanking(members, lines, { week, previousWeek: before, mode, metric });
  const mvp = weekMvp(members, lines, week);
  const together = togetherMatches(members, togetherLines);
  const weekLabel = formatWeek(week);
  const isOwner = role === "owner";
  const comparableCount = puuids.length;
  const viewerCanCompare = members.some((m) => m.isYou && m.puuid);
  const mixed = mode === ALL_MODES;

  return (
    <div className="content-enter flex flex-col gap-4 py-8 sm:py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="text-eyebrow text-fg-muted uppercase">Grupo</p>
          <h1 className="truncate text-heading text-fg">{group.name}</h1>
          <p className="num text-fg-secondary">
            {members.length} {members.length === 1 ? "membro" : "membros"}
            {isOwner ? " · você é o dono" : ""}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:shrink-0 sm:items-center">
          {comparableCount >= 2 ? (
            <Link
              href={`/groups/${group.slug}/compare`}
              className={buttonVariants({ variant: "ghost", size: "sm", className: isOwner ? "col-span-2" : "col-span-2 sm:w-fit" })}
            >
              <Swords aria-hidden="true" />
              Comparar 1x1
            </Link>
          ) : null}
          {isOwner ? (
            <>
              <CopyInviteButton code={group.inviteCode} />
              <Link
                href={`/groups/${group.slug}/settings`}
                className={buttonVariants({ variant: "ghost", size: "sm" })}
              >
                <Settings aria-hidden="true" />
                Ajustes do grupo
              </Link>
            </>
          ) : null}
        </div>
      </header>

      <FilterProvider>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-2">
          <GroupFilter name="week" label="Semana" options={WEEK_OPTIONS} value={weekChoice} fallback="current" />
          <p className="num text-label font-normal text-fg-muted">
            {weekLabel} · segunda a domingo, horário de Brasília
          </p>
          <div className="flex w-full flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
            <GroupFilter
              name="mode"
              label="Modo"
              options={modes.map((m) => ({ value: m, label: modeLabel(m) }))}
              value={mode}
              fallback={DEFAULT_MODE}
            />
            {mixed ? <Badge variant="outline">Médias misturam todos os modos</Badge> : null}
          </div>
        </div>

        {/*
          DOM order = mobile reading order: MVP → ranking → together → members.
          Desktop: ranking + together form one left item spanning two rows, so
          the right column (MVP on row 1, members on row 2) never leaves gaps.
        */}
        <FilteredContent className="grid gap-4 lg:grid-cols-12 lg:grid-rows-[auto_1fr] lg:items-start">
          <div className="lg:col-span-5 lg:col-start-8 lg:row-start-1">
            <MvpCard mvp={mvp} weekLabel={weekChoice === "last" ? "semana passada" : "esta semana"} />
          </div>
          <div className="flex flex-col gap-4 lg:col-span-7 lg:col-start-1 lg:row-span-2 lg:row-start-1">
          <section
            aria-labelledby="ranking-title"
            className="overflow-hidden rounded-card bg-surface-1 shadow-hairline"
          >
            <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 id="ranking-title" className="text-body-sm font-semibold text-fg">
                Ranking · {modeLabel(mode)}
              </h2>
              <GroupFilter
                name="metric"
                label="Métrica"
                options={RANKING_METRICS.map((m) => ({ value: m, label: METRIC_LABEL[m] }))}
                value={metric}
                fallback={DEFAULT_METRIC}
              />
            </header>
            {ranking.ranked.length === 0 ? (
              <EmptyState
                icon={Trophy}
                title={`Ninguém jogou partida ${modeAdjective(mode)} ${weekChoice === "last" ? "na semana passada" : "esta semana"}`.replace(/\s+/g, " ")}
                description={
                  weekChoice === "current"
                    ? "A semana começa na segunda às 0h. As partidas aparecem aqui até 15 minutos depois de cada jogo."
                    : "Volte para esta semana para ver quem já está jogando."
                }
                action={
                  <Link
                    href={`/groups/${group.slug}${weekChoice === "current" ? "?week=last" : ""}`}
                    className={buttonVariants()}
                  >
                    {weekChoice === "current" ? "Ver semana passada" : "Ver esta semana"}
                  </Link>
                }
              />
            ) : (
              <RankingList
                metric={METRIC_LABEL[metric]}
                deltaDigits={metric === "kd" ? 2 : 0}
                deltaSuffix={metric === "winrate" ? " p.p." : undefined}
                entries={ranking.ranked.map((e) => ({
                  id: e.member.userId,
                  name: e.member.name,
                  tag: e.member.tag,
                  image: e.member.image,
                  value: <AnimatedNumber {...metricNumber(metric, e.value)} kind={metric} align="end" />,
                  delta: metricDelta(metric, e.value, e.previous).delta,
                  matches: e.summary.matches,
                  detail: recordLine(e.summary),
                  isYou: e.member.isYou,
                }))}
              />
            )}
            {ranking.idle.length > 0 && ranking.ranked.length > 0 ? (
              <p className="border-t border-line px-4 py-3 text-label font-normal text-fg-muted">
                Sem partida {modeAdjective(mode)} nessa semana:{" "}
                <span className="text-fg-secondary">{ranking.idle.map((m) => m.name).join(", ")}</span>
              </p>
            ) : null}
            <p className="border-t border-line px-4 py-3 text-label font-normal text-fg-muted">
              Variação em relação à semana anterior. Médias ponderadas por round, como no seu painel.
            </p>
          </section>
          <section
            aria-labelledby="together-title"
            className="overflow-hidden rounded-card bg-surface-1 shadow-hairline"
          >
            <header className="flex flex-col gap-0.5 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <h2 id="together-title" className="text-body-sm font-semibold text-fg">
                Partidas que jogaram juntos
              </h2>
              <span className="text-label font-normal text-fg-muted">2+ membros no mesmo time · todos os modos</span>
            </header>
            {together.length === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="Nenhuma partida juntos ainda"
                description={
                  members.length < 2
                    ? "Assim que alguém entrar no grupo e vocês jogarem no mesmo time, a partida aparece aqui."
                    : "Quando dois ou mais membros jogarem no mesmo time, a partida aparece aqui com quem mandou melhor."
                }
              />
            ) : (
              <TogetherList matches={together} now={now} />
            )}
          </section>
          </div>
          <section
            aria-labelledby="members-title"
            className="overflow-hidden rounded-card bg-surface-1 shadow-hairline lg:col-span-5 lg:col-start-8 lg:row-start-2"
          >
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <h2 id="members-title" className="text-body-sm font-semibold text-fg">
                Membros
              </h2>
              <span className="num text-label font-normal text-fg-muted">{members.length}</span>
            </header>
            <ul className="divide-y divide-line">
              {members.map((m) => (
                <li key={m.userId} className={cn("flex min-h-12 items-center gap-3 px-4 py-2", m.isYou && "on-tint bg-accent-tint/60")}>
                  <Avatar name={m.name} image={m.image} />
                  <span className="flex min-w-0 flex-1 items-baseline gap-1">
                    <span className="truncate text-fg">{m.name}</span>
                    {m.tag ? (
                      <span className="font-mono text-label text-fg-muted">#{m.tag}</span>
                    ) : (
                      <span className="text-label font-normal text-fg-muted">sem Riot ID</span>
                    )}
                  </span>
                  {m.isYou ? <Badge variant="outline">você</Badge> : null}
                  {m.role === "owner" ? <Badge>dono</Badge> : null}
                  {!m.isYou && m.puuid && viewerCanCompare ? (
                    <Link
                      href={`/groups/${group.slug}/compare?b=${encodeURIComponent(m.userId)}`}
                      className={buttonVariants({ variant: "quiet", size: "sm", className: "-mr-2 shrink-0" })}
                      aria-label={`Comparar com ${m.name}`}
                    >
                      Comparar
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
            <footer className="flex flex-col gap-3 border-t border-line px-4 py-3">
              {isOwner && members.length === 1 ? (
                <p className="text-fg-secondary">Só você por enquanto. Copie o convite e mande para os amigos.</p>
              ) : null}
              {isOwner ? (
                <Link
                  href={`/groups/${group.slug}/settings`}
                  className={buttonVariants({ variant: "quiet", size: "sm", className: "w-full justify-start sm:w-fit" })}
                >
                  <Settings aria-hidden="true" />
                  Gerenciar membros e convite
                </Link>
              ) : (
                <LeaveGroupButton groupId={group.id} groupName={group.name} role={role} alone={members.length === 1} className="w-full sm:w-fit" />
              )}
            </footer>
          </section>


        </FilteredContent>
      </FilterProvider>
    </div>
  );
}
