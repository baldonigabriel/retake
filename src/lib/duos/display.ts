/**
 * Words for "Com quem você joga melhor". Trend language, never a verdict:
 * "você vence X% com…", "tende a", and a plain note when the sample is small.
 */
import { formatPercent } from "@/lib/format";
import { synergyTrend, type Duo } from "@/lib/stats/synergy";

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "13 pontos acima da sua média" / "parecido com a sua média". */
export function versusAverage(winRateDelta: number): string {
  const trend = synergyTrend(winRateDelta);
  if (trend === "flat") return "parecido com a sua média";
  const points = Math.round(Math.abs(winRateDelta) * 100);
  return `${plural(points, "ponto", "pontos")} ${trend === "up" ? "acima" : "abaixo"} da sua média`;
}

/** The sentence under the section title, about the top duo. */
export function duoHeadline(duo: Pick<Duo<{ name: string }>, "mate" | "summary" | "winRateDelta" | "smallSample">): string {
  const rate = formatPercent(duo.summary.winRate.rate, 0);
  const matches = plural(duo.summary.matches, "partida", "partidas");
  if (duo.smallSample) {
    return `Com ${duo.mate.name} a tendência é de ${rate} de vitórias em ${matches}, ${versusAverage(duo.winRateDelta)}. Ainda é pouca partida para cravar.`;
  }
  return `Com ${duo.mate.name} você vence ${rate} em ${matches}, ${versusAverage(duo.winRateDelta)}.`;
}
