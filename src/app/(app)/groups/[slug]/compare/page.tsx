import { ArrowLeft, UsersRound } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { FilteredContent, FilterProvider } from "@/components/dashboard/dashboard-filters";
import { CopyInviteButton } from "@/components/groups/group-buttons";
import { CompareCard } from "@/components/groups/compare-card";
import { ComparePicker } from "@/components/groups/compare-picker";
import { GroupFilter } from "@/components/groups/group-filters";
import { TogetherList } from "@/components/groups/together-list";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/states";
import { requireViewer } from "@/lib/auth/session";
import {
  COMPARE_PERIODS,
  DEFAULT_COMPARE_PERIOD,
  comparable,
  compareMembers,
  parseComparePeriod,
  resolvePair,
  type ComparePeriod,
} from "@/lib/groups/compare";
import { getGroupMembers, getMemberLines, getMembership } from "@/lib/groups/queries";
import { weekRange } from "@/lib/groups/week";
import { modeLabel } from "@/lib/modes";
import { ALL_MODES, DEFAULT_MODE } from "@/lib/stats/aggregate";
import { modeOptions, parseMode } from "@/lib/stats/breakdown";

export const metadata: Metadata = {
  title: "Comparação 1x1",
  description: "Dois membros do grupo lado a lado: ACS, K/D, HS%, ADR e vitórias.",
  robots: { index: false, follow: false },
};

const PERIOD_LABEL: Record<ComparePeriod, string> = { week: "Esta semana", "30d": "30 dias", all: "Tudo" };
const TOGETHER_LIMIT = 5;

function since(period: ComparePeriod, now: Date): Date {
  if (period === "week") return weekRange(now).start;
  if (period === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  return new Date(0);
}

/** Question this screen answers: "quem está jogando melhor, eu ou ele?" — only between members of the group. */
export default async function ComparePage({ params, searchParams }: PageProps<"/groups/[slug]/compare">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const { user } = await requireViewer(`/groups/${slug}/compare`);
  const membership = await getMembership(slug, user.id);
  if (!membership) notFound();
  const { group, role } = membership;

  const now = new Date();
  const members = comparable(await getGroupMembers(group.id, user.id));
  const pair = resolvePair(members, query);

  const back = (
    <Link
      href={`/groups/${group.slug}`}
      className="-ml-2 inline-flex min-h-11 w-fit items-center gap-1.5 rounded-control px-2 text-body-sm text-fg-secondary transition-colors duration-150 ease-out hover:text-fg sm:min-h-8"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {group.name}
    </Link>
  );

  if (!pair) {
    return (
      <div className="flex flex-col gap-4 py-8 sm:py-10">
        {back}
        <h1 className="text-heading text-fg">Comparação 1x1</h1>
        <section className="rounded-card bg-surface-1 shadow-hairline">
          <EmptyState
            icon={UsersRound}
            title="Falta alguém para comparar"
            description="A comparação precisa de dois membros do grupo com Riot ID vinculado. Chame um amigo com o link de convite."
            action={
              role === "owner" ? (
                <CopyInviteButton code={group.inviteCode} variant="default" />
              ) : (
                <Link href={`/groups/${group.slug}`} className={buttonVariants()}>
                  Voltar ao grupo
                </Link>
              )
            }
          />
        </section>
      </div>
    );
  }

  const period = parseComparePeriod(query.period);
  // Exactly these two players' lines: nobody else's numbers are read.
  const lines = await getMemberLines([pair.a.puuid, pair.b.puuid], since(period, now), new Date(now.getTime() + 60_000));
  const options = modeOptions(lines);
  const mode = parseMode(query.mode, options);
  const comparison = compareMembers(pair.a, pair.b, lines, mode);
  const { togetherRecord: rec } = comparison;
  const togetherCount = comparison.together.length;

  return (
    <div className="flex flex-col gap-4 py-8 sm:py-10">
      <header className="flex flex-col gap-2">
        {back}
        <h1 className="text-heading text-fg">Comparação 1x1</h1>
        <p className="max-w-[70ch] text-fg-secondary">
          Dois membros do grupo lado a lado, com as mesmas fórmulas do painel. Só entram membros com Riot ID vinculado.
        </p>
      </header>

      <FilterProvider>
        <div className="flex flex-col gap-3 rounded-card bg-surface-1 p-4 shadow-hairline sm:p-5">
          <ComparePicker
            options={members.map((m) => ({ id: m.userId, label: m.name }))}
            a={pair.a.userId}
            b={pair.b.userId}
          />
          <div className="flex flex-wrap items-center gap-2">
            <GroupFilter
              name="period"
              label="Período"
              options={COMPARE_PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
              value={period}
              fallback={DEFAULT_COMPARE_PERIOD}
            />
            <GroupFilter
              name="mode"
              label="Modo"
              options={options.map((o) => ({ value: o.value, label: modeLabel(o.value) }))}
              value={mode}
              fallback={DEFAULT_MODE}
            />
            {mode === ALL_MODES ? <Badge variant="outline">Médias misturam todos os modos</Badge> : null}
          </div>
        </div>

        <FilteredContent className="grid gap-4 lg:grid-cols-12 lg:items-start">
          <div className="flex flex-col gap-2 lg:col-span-7">
            <h2 className="text-eyebrow text-fg-muted uppercase">
              {modeLabel(mode)} · {PERIOD_LABEL[period].toLowerCase()}
            </h2>
            <CompareCard comparison={comparison} />
          </div>

          <section aria-labelledby="duo-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline lg:col-span-5 lg:mt-[21px]">
            <header className="flex flex-col gap-0.5 border-b border-line px-4 py-3">
              <h2 id="duo-title" className="text-body-sm font-semibold text-fg">
                No mesmo time
              </h2>
              {togetherCount > 0 ? (
                <p className="num text-label font-normal text-fg-muted">
                  {togetherCount} {togetherCount === 1 ? "partida" : "partidas"} · {rec.wins}V {rec.losses}D
                  {rec.draws > 0 ? ` ${rec.draws}E` : ""}
                  {rec.aBetter + rec.bBetter > 0
                    ? ` · maior ACS: ${pair.a.name} ${rec.aBetter}, ${pair.b.name} ${rec.bBetter}`
                    : ""}
                </p>
              ) : null}
            </header>
            {togetherCount === 0 ? (
              <EmptyState
                icon={UsersRound}
                title="Vocês não jogaram juntos nesse recorte"
                description="Quando os dois caírem no mesmo time, a partida aparece aqui com quem mandou melhor."
              />
            ) : (
              <>
                <TogetherList matches={comparison.together.slice(0, TOGETHER_LIMIT)} now={now} />
                {togetherCount > TOGETHER_LIMIT ? (
                  <p className="num border-t border-line px-4 py-3 text-label font-normal text-fg-muted">
                    {TOGETHER_LIMIT} mais recentes de {togetherCount}
                  </p>
                ) : null}
              </>
            )}
          </section>
        </FilteredContent>
      </FilterProvider>
    </div>
  );
}
