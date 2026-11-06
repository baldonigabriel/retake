/**
 * The weekly summary text: AI first (src/lib/ai fallback chain), then
 * rule-based sentences. The AI only ever sees the aggregated numbers
 * (WeeklyStats) and must not invent anything; `acceptSummary` enforces the
 * parts a machine can check (length, format, and that every number in the
 * text exists in the data).
 */
import { generateWithFallback, type Attempt, type ProviderId, type TextProvider } from "@/lib/ai";
import { formatNumber } from "@/lib/format";
import { MVP_MIN_MATCHES } from "@/lib/groups/ranking";

import type { WeeklyStats } from "./stats";

export type SummaryProvider = ProviderId | "rules";

export interface SummaryText {
  text: string;
  provider: SummaryProvider;
  /** Model id for AI providers; null for rules. */
  model: string | null;
  attempts: Attempt[];
}

export const SUMMARY_MIN_CHARS = 60;
export const SUMMARY_MAX_CHARS = 900;

export const SUMMARY_SYSTEM = [
  "Você escreve o resumo semanal de um grupo de amigos que jogam Valorant juntos.",
  "Regras:",
  "- Português do Brasil, tom descontraído e amigável, como uma mensagem no Discord do grupo.",
  "- Curto: de 3 a 5 frases, no máximo 600 caracteres, em um único parágrafo.",
  "- Use SOMENTE os dados do JSON. Não invente números, nomes, mapas, agentes, partidas nem acontecimentos.",
  "- Cite os números exatamente como aparecem no JSON. Não faça contas novas (porcentagens, médias, somas, diferenças).",
  "- Não mencione campos null ou com valor 0.",
  "- 'outrosModos' são partidas fora do competitivo: se citar, deixe claro que são de outros modos.",
  "- Sem títulos, listas, hashtags ou links. No máximo um emoji.",
  "- Provocação leve entre amigos pode; nada ofensivo.",
  "Responda apenas com o texto do resumo.",
].join("\n");

export function summaryPrompt(stats: WeeklyStats): string {
  return `Dados da semana do grupo (JSON):\n${JSON.stringify(stats, null, 2)}`;
}

/* ------------------------------------------------------------ checks -- */

function collectNumbers(value: unknown, into: Set<number>): void {
  if (typeof value === "number") into.add(Math.round(value * 100) / 100);
  else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, into));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectNumbers(v, into));
}

function collectNames(stats: WeeklyStats): string[] {
  const names = [
    stats.grupo,
    stats.semana,
    ...stats.jogadores.map((j) => j.nome),
    stats.mvp?.nome,
    stats.maiorPlacar?.nome,
    stats.maiorPlacar?.mapa,
    stats.maisEvoluiu?.nome,
  ];
  // Longest first, so "p12 o tal" goes before a shorter name inside it.
  return [...new Set(names.filter((n): n is string => !!n))].sort((a, b) => b.length - a.length);
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The reply as it will be posted, or null to reject it (the chain then tries
 * the next provider). Rejects: too short or long, code/JSON/links, and any
 * number that isn't in the data (names and the week label, which may contain
 * digits, are removed before checking).
 */
export function acceptSummary(raw: string, stats: WeeklyStats): string | null {
  let text = raw.trim().replace(/^["“”']+|["“”']+$/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < SUMMARY_MIN_CHARS || text.length > SUMMARY_MAX_CHARS) return null;
  if (/```|[{}]|https?:\/\/|@everyone|@here/i.test(text)) return null;

  let scrubbed = text;
  for (const name of collectNames(stats)) scrubbed = scrubbed.replace(new RegExp(escapeRegExp(name), "gi"), " ");

  const allowed = new Set<number>([1, 2, 3]);
  collectNumbers(stats, allowed);
  for (const match of scrubbed.matchAll(/\d+(?:[.,]\d+)?/g)) {
    const n = Math.round(Number(match[0].replace(",", ".")) * 100) / 100;
    if (!allowed.has(n)) return null;
  }
  text = text.replace(/[ \t]+/g, " ");
  return text;
}

/* ------------------------------------------------------------- rules -- */

/** Small stable hash, so the same group and week always get the same wording. */
export function seedOf(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;
const pick = <T>(list: readonly T[], seed: number, slot: number): T => list[(seed + slot * 7) % list.length]!;

type Line = (s: WeeklyStats) => string;

const OPENERS: Line[] = [
  (s) => `Semana ${s.semana} fechada no ${s.grupo}: ${plural(s.partidas, "competitiva", "competitivas")}, com ${record(s)}.`,
  (s) => `Balanço do ${s.grupo} (${s.semana}): ${plural(s.partidas, "partida competitiva", "partidas competitivas")} e ${record(s)}.`,
  (s) => `${s.grupo} na semana ${s.semana}: foram ${plural(s.partidas, "competitiva", "competitivas")}, com ${record(s)}.`,
];

function record(s: WeeklyStats): string {
  const parts = [plural(s.vitorias, "vitória", "vitórias"), plural(s.derrotas, "derrota", "derrotas")];
  if (s.empates > 0) parts.push(plural(s.empates, "empate", "empates"));
  return parts.length === 3 ? `${parts[0]}, ${parts[1]} e ${parts[2]}` : `${parts[0]} e ${parts[1]}`;
}

const MOOD_GOOD = ["Semana boa pro grupo.", "Deu pra subir o astral.", "O time tá voando."];
const MOOD_BAD = ["Semana dura, mas faz parte.", "Não foi a semana mais fácil.", "A próxima tem que ser melhor."];

const MVP_LINES: Line[] = [
  (s) => `O MVP foi ${s.mvp!.nome}, com ${formatNumber(s.mvp!.acs)} de ACS em ${plural(s.mvp!.partidas, "partida", "partidas")}.`,
  (s) => `${s.mvp!.nome} levou o MVP: ${formatNumber(s.mvp!.acs)} de ACS e K/D de ${formatNumber(s.mvp!.kd, 2)}.`,
  (s) => `Destaque da semana: ${s.mvp!.nome}, MVP com ${formatNumber(s.mvp!.acs)} de ACS.`,
];

const BEST_LINES: Line[] = [
  (s) => `A melhor partida foi de ${s.maiorPlacar!.nome} em ${s.maiorPlacar!.mapa}: ${formatNumber(s.maiorPlacar!.acs)} de ACS (${s.maiorPlacar!.abates}/${s.maiorPlacar!.mortes}/${s.maiorPlacar!.assistencias}).`,
  (s) => `Maior placar da semana: ${s.maiorPlacar!.nome}, com ${formatNumber(s.maiorPlacar!.acs)} de ACS em ${s.maiorPlacar!.mapa}.`,
  (s) => `Em ${s.maiorPlacar!.mapa}, ${s.maiorPlacar!.nome} fez a partida da semana: ${formatNumber(s.maiorPlacar!.acs)} de ACS.`,
];

const EVOLVED_LINES: Line[] = [
  (s) => `Quem mais evoluiu foi ${s.maisEvoluiu!.nome}: de ${formatNumber(s.maisEvoluiu!.acsSemanaPassada)} para ${formatNumber(s.maisEvoluiu!.acsSemana)} de ACS.`,
  (s) => `${s.maisEvoluiu!.nome} subiu ${formatNumber(s.maisEvoluiu!.diferenca)} de ACS em relação à semana passada.`,
];

const TOGETHER_LINES: Line[] = [
  (s) => `Jogaram juntos em ${plural(s.partidasJuntos, "partida", "partidas")}.`,
  (s) => `Teve ${plural(s.partidasJuntos, "partida", "partidas")} com a galera no mesmo time.`,
];

const CLOSERS = ["Bora pra próxima!", "Semana que vem tem mais.", "GG, galera.", "Até o próximo resumo."];

/** Rule-based summary with varied sentence templates (last resort, always works). */
export function rulesSummary(s: WeeklyStats, seed = seedOf(`${s.grupo}|${s.semana}`)): string {
  if (s.partidas === 0) {
    return `Semana ${s.semana} sem competitiva no ${s.grupo}, mas ${s.outrosModos === 1 ? "rolou 1 partida" : `rolaram ${formatNumber(s.outrosModos)} partidas`} em outros modos. ${pick(CLOSERS, seed, 5)}`;
  }
  const lines = [pick(OPENERS, seed, 0)(s)];
  if (s.partidas >= 3 && s.taxaVitoria >= 60) lines.push(pick(MOOD_GOOD, seed, 1));
  else if (s.partidas >= 3 && s.taxaVitoria <= 40) lines.push(pick(MOOD_BAD, seed, 1));
  lines.push(s.mvp ? pick(MVP_LINES, seed, 2)(s) : `Ninguém chegou a ${MVP_MIN_MATCHES} competitivas, então a semana ficou sem MVP.`);
  if (s.maiorPlacar && s.maiorPlacar.nome !== s.mvp?.nome) lines.push(pick(BEST_LINES, seed, 3)(s));
  else if (s.maiorPlacar) lines.push(`A melhor partida também foi de ${s.maiorPlacar.nome}: ${formatNumber(s.maiorPlacar.acs)} de ACS em ${s.maiorPlacar.mapa}.`);
  if (s.maisEvoluiu) lines.push(pick(EVOLVED_LINES, seed, 4)(s));
  if (s.partidasJuntos > 0) lines.push(pick(TOGETHER_LINES, seed, 6)(s));
  lines.push(pick(CLOSERS, seed, 5));
  return lines.join(" ");
}

/* --------------------------------------------------------------- main -- */

export async function writeSummary(
  stats: WeeklyStats,
  providers: readonly TextProvider[],
  options: { seed?: number } = {},
): Promise<SummaryText> {
  const attempts: Attempt[] = [];
  const ai = await generateWithFallback(
    providers,
    { system: SUMMARY_SYSTEM, prompt: summaryPrompt(stats), maxOutputTokens: 1024 },
    { accept: (raw) => acceptSummary(raw, stats), attempts },
  );
  if (ai) return { text: ai.text, provider: ai.provider, model: ai.model, attempts };
  return { text: rulesSummary(stats, options.seed), provider: "rules", model: null, attempts };
}
