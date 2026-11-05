/**
 * The one-line answer to the dashboard's question ("estou melhorando?"),
 * based on ACS: last 20 matches vs. the whole selection.
 */
import { formatNumber } from "@/lib/format";
import type { RecentComparison } from "@/lib/stats/breakdown";

/** Below this ACS difference we call it stable. */
export const STABLE_ACS = 5;

const plural = (n: number, one: string, many: string) => `${formatNumber(n)} ${n === 1 ? one : many}`;

export function verdict(cmp: RecentComparison, window: number): string | null {
  const { recent, overall } = cmp;
  if (overall.matches === 0) return null;
  const overallAcs = Math.round(overall.acs);

  if (!cmp.comparable) {
    return `Com ${plural(overall.matches, "partida", "partidas")}, ainda é cedo para comparar. Seu ACS médio é ${formatNumber(overallAcs)}.`;
  }

  const recentAcs = Math.round(recent.acs);
  const diff = recentAcs - overallAcs;
  const base = `seu ACS nas últimas ${window} é ${formatNumber(recentAcs)}`;
  const avg = `da sua média de ${plural(overall.matches, "partida", "partidas")}`;
  if (diff >= STABLE_ACS) return `Sim: ${base}, ${formatNumber(diff)} acima ${avg}.`;
  if (diff <= -STABLE_ACS) return `Ainda não: ${base}, ${formatNumber(-diff)} abaixo ${avg}.`;
  return `Estável: ${base}, perto ${avg} (${formatNumber(overallAcs)}).`;
}
