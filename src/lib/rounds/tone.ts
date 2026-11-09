/**
 * Whether a round metric reads as good or bad, for the colours of the rounds
 * panel. Colour is always paired with ▲/▼ and text in the UI (CLAUDE.md ›
 * UI/UX). Small samples stay neutral so one round never paints a map red.
 *
 * The references for clutches and economy are approximations of what a
 * typical player wins in each spot, not exact averages: the UI says so.
 */
import type { ClutchByX, EconomyMetric, RateMetric } from "./metrics";

export type Tone = "good" | "bad" | "neutral";

/** Below this many rounds a side win rate stays neutral. */
export const SIDE_MIN_ROUNDS = 10;
/** Below this many situations a clutch spot stays neutral. */
export const CLUTCH_MIN_SITUATIONS = 3;
/** Below this many rounds an economy band stays neutral. */
export const ECONOMY_MIN_ROUNDS = 10;
/** KAST at or above this is good; below KAST_LOW is bad; in between, neutral. */
export const KAST_GOOD = 0.7;
export const KAST_LOW = 0.65;

/** Approximate win rate of each clutch spot for a typical player. */
export const CLUTCH_REFERENCE: Record<keyof ClutchByX, number> = { 1: 0.5, 2: 0.25, 3: 0.1, 4: 0.04, 5: 0.01 };
/** Approximate round win rate of each buy for a typical team. */
export const ECONOMY_REFERENCE: Record<EconomyMetric["band"], number> = { pistol: 0.5, eco: 0.15, force: 0.35, full: 0.55 };

function against(value: number | null, reference: number, sample: number, minSample: number): Tone {
  if (value === null || sample < minSample || value === reference) return "neutral";
  return value > reference ? "good" : "bad";
}

/** Attack or defence win rate on a map, against 50%. */
export function sideTone(side: RateMetric): Tone {
  return against(side.value, 0.5, side.sample, SIDE_MIN_ROUNDS);
}

/** Opening duels: more first bloods than first deaths is good. */
export function openingTone(firstBlood: RateMetric, firstDeath: RateMetric): Tone {
  if (firstBlood.sample === 0) return "neutral";
  const diff = firstBlood.successes - firstDeath.successes;
  return diff > 0 ? "good" : diff < 0 ? "bad" : "neutral";
}

export function kastTone(kast: RateMetric): Tone {
  if (kast.value === null || kast.sample < SIDE_MIN_ROUNDS) return "neutral";
  return kast.value >= KAST_GOOD ? "good" : kast.value < KAST_LOW ? "bad" : "neutral";
}

export function clutchTone(x: keyof ClutchByX, spot: ClutchByX[keyof ClutchByX]): Tone {
  return against(spot.rate, CLUTCH_REFERENCE[x], spot.situations, CLUTCH_MIN_SITUATIONS);
}

/** All clutch spots together, against the reference weighted by how often each spot happened. */
export function clutchTotalTone(clutch: ClutchByX): Tone {
  let situations = 0;
  let wins = 0;
  let expected = 0;
  for (const x of [1, 2, 3, 4, 5] as const) {
    situations += clutch[x].situations;
    wins += clutch[x].wins;
    expected += clutch[x].situations * CLUTCH_REFERENCE[x];
  }
  if (situations < CLUTCH_MIN_SITUATIONS) return "neutral";
  return against(wins / situations, expected / situations, situations, CLUTCH_MIN_SITUATIONS);
}

export function economyTone(entry: EconomyMetric): Tone {
  return against(entry.winRate, ECONOMY_REFERENCE[entry.band], entry.rounds, ECONOMY_MIN_ROUNDS);
}
