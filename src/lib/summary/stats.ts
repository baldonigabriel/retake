/**
 * The week's numbers for a group, computed by code (never by the AI). Pure:
 * takes the members and their match lines for this week and the one before.
 *
 * Everything is COMPETITIVE (like the MVP rule), with the other modes only
 * counted and labelled as such. Only members appear: other players in those
 * matches are never named or counted.
 *
 * Keys are in Portuguese on purpose: this object is what the AI reads, and
 * it writes the summary in Portuguese.
 */
import { MVP_MIN_MATCHES, weekMvp, type GroupLine, type GroupMember } from "@/lib/groups/ranking";
import { inWeek, type WeekRange } from "@/lib/groups/week";
import { DEFAULT_MODE, filterByMode, matchResult, summarize } from "@/lib/stats/aggregate";
import { acs } from "@/lib/stats/metrics";

export interface WeeklyStats {
  grupo: string;
  /** "2 – 8 de nov" */
  semana: string;
  modo: "competitivo";
  /** Distinct competitive matches with at least one member. */
  partidas: number;
  vitorias: number;
  derrotas: number;
  empates: number;
  /** Percent, already rounded, so nobody has to compute it. */
  taxaVitoria: number;
  /** Matches with 2+ members on the same team. */
  partidasJuntos: number;
  /** Matches in other modes (only counted). */
  outrosModos: number;
  jogadores: { nome: string; partidas: number; vitorias: number; acs: number }[];
  mvp: { nome: string; acs: number; kd: number; partidas: number } | null;
  maiorPlacar: { nome: string; acs: number; mapa: string; abates: number; mortes: number; assistencias: number } | null;
  maisEvoluiu: { nome: string; acsSemanaPassada: number; acsSemana: number; diferenca: number } | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function buildWeeklyStats(input: {
  groupName: string;
  weekLabel: string;
  members: readonly GroupMember[];
  lines: readonly GroupLine[];
  week: WeekRange;
  previousWeek: WeekRange;
}): WeeklyStats {
  const { members, week, previousWeek } = input;
  const byPuuid = new Map(members.filter((m) => m.puuid).map((m) => [m.puuid!, m]));
  const memberLines = input.lines.filter((l) => byPuuid.has(l.puuid));
  const thisWeek = memberLines.filter((l) => inWeek(l.startedAt, week));
  const comp = filterByMode(thisWeek, DEFAULT_MODE);

  // Group record: one result per match. A member on the winning side makes it a win.
  const matches = new Map<string, { win: boolean; draw: boolean }>();
  for (const l of comp) {
    const result = matchResult(l);
    const m = matches.get(l.matchId) ?? { win: false, draw: result === "draw" };
    if (result === "win") m.win = true;
    matches.set(l.matchId, m);
  }
  let vitorias = 0;
  let empates = 0;
  for (const m of matches.values()) {
    if (m.win) vitorias++;
    else if (m.draw) empates++;
  }
  const partidas = matches.size;

  const sides = new Map<string, number>();
  for (const l of comp) sides.set(`${l.matchId}\u0000${l.team}`, (sides.get(`${l.matchId}\u0000${l.team}`) ?? 0) + 1);
  const together = new Set([...sides.entries()].filter(([, n]) => n >= 2).map(([k]) => k.split("\u0000")[0]));

  const other = new Set(thisWeek.filter((l) => l.queueId !== DEFAULT_MODE).map((l) => l.matchId));

  const jogadores = [...byPuuid.values()]
    .map((m) => {
      const mine = comp.filter((l) => l.puuid === m.puuid);
      const s = summarize(mine, { mode: DEFAULT_MODE });
      return { nome: m.name, partidas: s.matches, vitorias: s.winRate.wins, acs: Math.round(s.acs) };
    })
    .filter((j) => j.partidas > 0)
    .sort((a, b) => b.acs - a.acs || b.partidas - a.partidas || a.nome.localeCompare(b.nome, "pt-BR"));

  const mvp = weekMvp(members, memberLines, week);

  let best: WeeklyStats["maiorPlacar"] = null;
  let bestAcs = -1;
  for (const l of comp) {
    const value = acs(l.score, l.roundsPlayed);
    if (value > bestAcs) {
      bestAcs = value;
      best = {
        nome: byPuuid.get(l.puuid)!.name,
        acs: Math.round(value),
        mapa: l.mapName ?? "mapa desconhecido",
        abates: l.kills,
        mortes: l.deaths,
        assistencias: l.assists,
      };
    }
  }

  let evolved: WeeklyStats["maisEvoluiu"] = null;
  for (const m of byPuuid.values()) {
    const now = comp.filter((l) => l.puuid === m.puuid);
    const before = filterByMode(
      memberLines.filter((l) => l.puuid === m.puuid && inWeek(l.startedAt, previousWeek)),
      DEFAULT_MODE,
    );
    if (now.length < MVP_MIN_MATCHES || before.length < MVP_MIN_MATCHES) continue;
    const a = Math.round(summarize(before, { mode: DEFAULT_MODE }).acs);
    const b = Math.round(summarize(now, { mode: DEFAULT_MODE }).acs);
    if (b - a >= 1 && (!evolved || b - a > evolved.diferenca)) {
      evolved = { nome: m.name, acsSemanaPassada: a, acsSemana: b, diferenca: b - a };
    }
  }

  return {
    grupo: input.groupName,
    semana: input.weekLabel,
    modo: "competitivo",
    partidas,
    vitorias,
    derrotas: partidas - vitorias - empates,
    empates,
    taxaVitoria: partidas > 0 ? Math.round((vitorias / partidas) * 100) : 0,
    partidasJuntos: together.size,
    outrosModos: other.size,
    jogadores,
    mvp: mvp
      ? { nome: mvp.member.name, acs: Math.round(mvp.summary.acs), kd: round2(mvp.summary.kd), partidas: mvp.summary.matches }
      : null,
    maiorPlacar: best,
    maisEvoluiu: evolved,
  };
}

/** Nothing to say: no member played any match this week. */
export const isEmptyWeek = (s: WeeklyStats) => s.partidas === 0 && s.outrosModos === 0;
