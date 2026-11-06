import { Check, CircleAlert, Clock3, Minus } from "lucide-react";

import { AnimatedNumber } from "@/components/stats/animated-number";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/states";
import { GOAL_SPEC, MAX_GOALS, evaluateGoal, formatTarget, type GoalProgress } from "@/lib/goals/goals";
import { listGoals } from "@/lib/goals/queries";
import type { PlayerMatchLine } from "@/lib/stats/aggregate";
import { cn } from "@/lib/utils";

import { DeleteGoalButton, RetryButton } from "./goal-buttons";
import { NewGoal } from "./new-goal";

const STATUS: Record<GoalProgress["status"], { text: string; icon: typeof Check; className: string }> = {
  reached: { text: "Batida", icon: Check, className: "bg-win-tint text-win" },
  below: { text: "Abaixo", icon: Minus, className: "bg-surface-3 text-fg-secondary" },
  provisional: { text: "Parcial", icon: Clock3, className: "bg-surface-3 text-fg-secondary" },
  "not-started": { text: "Sem partidas", icon: Clock3, className: "bg-surface-3 text-fg-muted" },
};

function Shell({ aside, children }: { aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section aria-labelledby="goals-title" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <h2 id="goals-title" tabIndex={-1} className="text-body-sm font-semibold text-fg focus-visible:outline-none">
          Metas da semana
        </h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function GoalRow({ id, progress, lastWeek }: { id: string; progress: GoalProgress; lastWeek: GoalProgress }) {
  const status = STATUS[progress.status];
  const Icon = status.icon;
  const counted = lastWeek.status === "reached" || lastWeek.status === "below";
  return (
    <li className="flex animate-enter flex-col gap-2 px-4 py-3 motion-reduce:animate-none">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1 truncate font-medium text-fg">{progress.label}</p>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-chip px-1.5 py-0.5 text-label", status.className)}>
          <Icon aria-hidden="true" className="size-3" />
          {status.text}
        </span>
        <DeleteGoalButton goalId={id} label={progress.label} />
      </div>
      <div className="flex items-center gap-3">
        <p className="num flex shrink-0 items-baseline gap-1">
          <span className="stat text-[24px] leading-none font-semibold text-fg">
            <AnimatedNumber
              value={progress.value}
              digits={GOAL_SPEC[progress.metric].digits}
              suffix={GOAL_SPEC[progress.metric].unit || undefined}
            />
          </span>
          <span className="text-label font-normal text-fg-muted">/ {formatTarget(progress.metric, progress.target)}</span>
        </p>
        <span
          role="progressbar"
          aria-label={`Progresso: ${progress.label}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress.ratio * 100)}
          aria-valuetext={progress.note}
          className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3"
        >
          <span
            className={cn("goal-fill block h-full rounded-full", progress.status === "reached" ? "bg-win" : "bg-fg-secondary")}
            style={{ width: `${progress.ratio * 100}%` }}
          />
        </span>
      </div>
      <div className="num flex flex-col gap-0.5 text-label font-normal text-fg-muted">
        <p>{progress.note}</p>
        {counted ? <p>Semana passada: {lastWeek.status === "reached" ? "batida" : "não batida"}</p> : null}
      </div>
    </li>
  );
}

/**
 * "Metas da semana" on /me. Loads its own data inside a Suspense boundary so
 * a failure here shows a local error state instead of breaking the dashboard.
 */
export async function GoalsPanel({
  userId,
  weekLines,
  lastWeekLines,
  weekLabel,
}: {
  userId: string;
  weekLines: readonly PlayerMatchLine[];
  lastWeekLines: readonly PlayerMatchLine[];
  weekLabel: string;
}) {
  let goals;
  try {
    goals = await listGoals(userId);
  } catch (error) {
    console.error("[goals] list failed", error);
    return (
      <Shell>
        <ErrorState
          icon={CircleAlert}
          title="Não conseguimos carregar suas metas"
          description="O resto do painel continua certo. Tente de novo em alguns segundos; suas metas estão salvas."
          action={<RetryButton />}
        />
      </Shell>
    );
  }

  const aside = <span className="num text-label font-normal text-fg-muted">Competitivo · {weekLabel}</span>;
  if (goals.length === 0) {
    return (
      <Shell aside={aside}>
        <NewGoal existing={[]} empty />
      </Shell>
    );
  }

  return (
    <Shell aside={aside}>
      {/* Side by side on desktop (one column per goal), stacked on phones. */}
      <ul
        className={cn(
          "divide-y divide-line lg:grid lg:divide-x lg:divide-y-0",
          goals.length === 2 && "lg:grid-cols-2",
          goals.length === 3 && "lg:grid-cols-3",
        )}
      >
        {goals.map((g) => (
          <GoalRow key={g.id} id={g.id} progress={evaluateGoal(g, weekLines)} lastWeek={evaluateGoal(g, lastWeekLines)} />
        ))}
      </ul>
      {goals.length < MAX_GOALS ? (
        <NewGoal existing={goals} />
      ) : (
        <p className="border-t border-line px-4 py-3 text-label font-normal text-fg-muted">
          {MAX_GOALS} de {MAX_GOALS} metas. Remova uma para criar outra.
        </p>
      )}
    </Shell>
  );
}

export function GoalsPanelSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-36" />
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <div key={i} className="flex flex-col gap-2 border-t border-line px-4 py-3 first:border-t-0">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-1.5 flex-1" />
          </div>
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </div>
  );
}
