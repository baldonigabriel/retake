import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { AgentAvatar } from "@/components/match/agent-avatar";
import { RESULT_LABEL, RESULT_LETTER } from "@/components/stats/result-chip";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { agentIconUrl } from "@/lib/assets";
import { getMatchExtras } from "@/lib/dashboard/queries";
import { DISPLAY_TIME_ZONE, formatNumber, formatSigned } from "@/lib/format";
import { modeLabel } from "@/lib/modes";
import { matchResult } from "@/lib/stats/aggregate";
import type { DetailedLine } from "@/lib/stats/breakdown";
import { acs, type MatchResult } from "@/lib/stats/metrics";
import { summarizeSession, type CurrentSession } from "@/lib/stats/session";
import { cn } from "@/lib/utils";

type SessionLine = DetailedLine & { rrChange: number | null };

const LETTER: Record<MatchResult, string> = { win: "bg-win-tint text-win", loss: "bg-loss-tint text-loss", draw: "bg-surface-3 text-draw" };

const clock = (d: Date) =>
  d.toLocaleTimeString("pt-BR", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit" });

function Shell({ status, modes, children }: { status: string; modes?: string[]; children: React.ReactNode }) {
  return (
    <section aria-labelledby="session-title" className="content-enter overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-4 py-3">
        <h2 id="session-title" tabIndex={-1} className="text-body-sm font-semibold text-fg focus-visible:outline-none">
          Sessão de hoje
        </h2>
        <span className="flex flex-wrap items-center gap-2">
          {modes && modes.length > 1 ? <Badge variant="outline">Mistura {modes.map((m) => modeLabel(m)).join(" e ")}</Badge> : null}
          <span className="num text-label font-normal text-fg-muted">{status}</span>
        </span>
      </header>
      {children}
    </section>
  );
}

function Stat({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <dt className="text-eyebrow text-fg-muted uppercase">{label}</dt>
      <dd className="flex min-w-0 flex-col gap-0.5">{children}</dd>
    </div>
  );
}

/** Skeleton with the card's shape: header, four numbers, the result strip, best match. */
export function SessionCardSkeleton() {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-card bg-surface-1 shadow-hairline">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-40" />
      </div>
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-14" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
        <Skeleton className="h-16 w-full rounded-control" />
      </div>
    </div>
  );
}

function statusLine(session: CurrentSession<unknown>): string {
  return session.ongoing
    ? `Em andamento · começou às ${clock(session.startedAt)}`
    : `Encerrada às ${clock(session.endedAt)} · começou às ${clock(session.startedAt)}`;
}

/**
 * "Sessão de hoje" at the top of /me: matches in the current session (or the
 * one that ended today), V–D, RR, ACS and the best match. Loads its RR inside
 * its own Suspense boundary; if that fails, the rest still shows, with RR as "—".
 */
export async function SessionCard({
  puuid,
  session,
  note,
}: {
  puuid: string;
  session: CurrentSession<DetailedLine>;
  /** Shown above the numbers (the break note). */
  note?: React.ReactNode;
}) {
  let rrFailed = false;
  let extras: Awaited<ReturnType<typeof getMatchExtras>> = new Map();
  try {
    extras = await getMatchExtras(
      puuid,
      session.lines.map((l) => l.matchId),
    );
  } catch (error) {
    console.error("[session] rr failed", error);
    rrFailed = true;
  }
  const lines: SessionLine[] = session.lines.map((l) => ({
    ...l,
    rrChange: l.queueId === "competitive" ? (extras.get(l.matchId)?.rrChange ?? null) : null,
  }));
  const s = summarizeSession(lines);
  const best = s.best;
  const mixed = s.modes.length > 1;

  return (
    <Shell status={statusLine(session)} modes={s.modes}>
      {note}
      <div className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-center lg:gap-8">
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Partidas">
              <span className="stat text-stat-md text-fg">{s.matches}</span>
            </Stat>
            <Stat label="V–D">
              <span className="sr-only">
                {s.wins} vitórias, {s.losses} derrotas{s.draws ? `, ${s.draws} empates` : ""}
              </span>
              <span aria-hidden="true" className="stat text-stat-md text-fg">
                {s.wins}–{s.losses}
                {s.draws ? <span className="ml-1 text-[18px] text-fg-muted">{s.draws}E</span> : null}
              </span>
            </Stat>
            <Stat label="RR">
              {s.competitive === 0 ? (
                <>
                  <span className="stat text-stat-md text-fg-muted">—</span>
                  <span className="text-label font-normal text-fg-muted">sem competitiva</span>
                </>
              ) : rrFailed || s.rrMissing === s.competitive ? (
                <>
                  <span className="stat text-stat-md text-fg-muted">—</span>
                  <span className="text-label font-normal text-fg-muted">
                    {rrFailed ? "indisponível agora; atualize a página" : "ainda chegando"}
                  </span>
                </>
              ) : (
                <>
                  <span
                    className={cn(
                      "stat inline-flex items-baseline gap-1 text-stat-md",
                      s.rr > 0 ? "text-win" : s.rr < 0 ? "text-loss" : "text-fg",
                    )}
                  >
                    <span aria-hidden="true" className="text-[14px] leading-none">
                      {s.rr > 0 ? "▲" : s.rr < 0 ? "▼" : ""}
                    </span>
                    <span className="sr-only">{s.rr > 0 ? "ganhou" : s.rr < 0 ? "perdeu" : "saldo de"}</span>
                    {formatSigned(s.rr, 0)}
                  </span>
                  {s.rrMissing > 0 ? (
                    <span className="num text-label font-normal text-fg-muted">
                      {s.rrMissing} {s.rrMissing === 1 ? "partida ainda sem RR" : "partidas ainda sem RR"}
                    </span>
                  ) : null}
                </>
              )}
            </Stat>
            <Stat label={mixed ? "ACS (modos juntos)" : "ACS médio"}>
              <span className="stat text-stat-md text-fg">{formatNumber(Math.round(s.acs))}</span>
            </Stat>
          </dl>
          <ol aria-label="Resultados na ordem em que foram jogados" className="flex flex-wrap gap-1">
            {lines
              .slice()
              .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
              .map((l, i) => {
                const result = matchResult(l);
                return (
                  <li
                    key={l.matchId}
                    className={cn("stat inline-flex size-6 items-center justify-center rounded-chip text-[14px] font-bold", LETTER[result])}
                  >
                    <span aria-hidden="true">{RESULT_LETTER[result]}</span>
                    <span className="sr-only">
                      Partida {i + 1}: {RESULT_LABEL[result]}
                    </span>
                  </li>
                );
              })}
          </ol>
        </div>
        {best ? <BestMatch line={best} /> : null}
      </div>
    </Shell>
  );
}

function BestMatch({ line }: { line: SessionLine }) {
  const result = matchResult(line);
  return (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow text-fg-muted uppercase">Melhor jogo</p>
      <Link
        href={`/match/${line.matchId}`}
        className="hover-layer press relative flex min-h-16 items-center gap-3 rounded-control bg-surface-2 px-3 py-2.5 shadow-hairline [--hover-bg:var(--color-surface-3)] focus-visible:outline-offset-2"
      >
        <AgentAvatar agent={line.agentName ?? "Agente"} src={agentIconUrl(line.agentId)} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate font-medium text-fg">
            {line.agentName ?? "Agente"} na {line.mapName ?? "mapa desconhecido"}
          </span>
          <span className="num truncate text-label font-normal text-fg-secondary">
            <span className={cn(result === "win" ? "text-win" : result === "loss" ? "text-loss" : "text-draw")}>
              {RESULT_LABEL[result]}
            </span>{" "}
            · K/D/A <span className="font-mono">{line.kills}/{line.deaths}/{line.assists}</span>
            {line.queueId !== "competitive" ? ` · ${modeLabel(line.queueId, line.mode)}` : ""}
          </span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="stat text-[24px] leading-none font-semibold text-fg">{formatNumber(Math.round(acs(line.score, line.roundsPlayed)))}</span>
          <span className="text-label font-normal text-fg-secondary">ACS</span>
        </span>
        <ChevronRight aria-hidden="true" className="-mr-1 size-4 shrink-0 text-fg-secondary" />
      </Link>
    </div>
  );
}
