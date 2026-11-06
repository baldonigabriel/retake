/**
 * Bagre periods (docs/SPEC.md §5.1). Pure: no database, no clock of its own.
 *
 * - weekly: Monday 00:00 → next Monday 00:00 in America/Sao_Paulo;
 * - daily: 00:00 → next 00:00 in the same zone.
 * Ranges are half-open [start, end). A new period never starts before the
 * previous one ended, so switching daily → weekly on a Thursday gives a
 * Thursday–Sunday week and no day belongs to two periods.
 */
import { dayRange, weekRange, WEEK_TIME_ZONE, type WeekRange } from "@/lib/groups/week";

export const CADENCES = ["weekly", "daily"] as const;
export type Cadence = (typeof CADENCES)[number];
export const DEFAULT_CADENCE: Cadence = "weekly";

export type PeriodRange = WeekRange;

/** The calendar period of `cadence` containing `now`. */
export function periodRange(cadence: Cadence, now: Date): PeriodRange {
  return cadence === "daily" ? dayRange(now) : weekRange(now);
}

/**
 * The range for a new period opened at `now`: the calendar period, starting
 * no earlier than the end of the latest period (if it ended after the
 * calendar start). Null when `now` is still inside the latest period.
 */
export function nextPeriodRange(cadence: Cadence, now: Date, latestEnd: Date | null): PeriodRange | null {
  if (latestEnd && now.getTime() < latestEnd.getTime()) return null;
  const range = periodRange(cadence, now);
  if (latestEnd && latestEnd.getTime() > range.start.getTime()) return { start: latestEnd, end: range.end };
  return range;
}

/** The badge lasts until the end of the period after the one won (same cadence). */
export function badgeUntil(cadence: Cadence, endsAt: Date): Date {
  return periodRange(cadence, endsAt).end;
}

export const BADGE_TITLE: Record<Cadence, string> = { weekly: "Bagre da Semana", daily: "Bagre do Dia" };
export const CADENCE_LABEL: Record<Cadence, string> = { weekly: "Semanal", daily: "Diário" };
/** "da semana" / "do dia", for sentences like "o Bagre da semana". */
export const PERIOD_NOUN: Record<Cadence, { this: string; last: string; of: string }> = {
  weekly: { this: "esta semana", last: "semana passada", of: "da semana" },
  daily: { this: "hoje", last: "ontem", of: "do dia" },
};

/** Minimum competitive matches for the "lowest average ACS" suggestion. */
export const MIN_MATCHES_FOR_AVERAGE: Record<Cadence, number> = { weekly: 3, daily: 2 };

const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) =>
  d.toLocaleDateString("pt-BR", { timeZone: WEEK_TIME_ZONE, ...opts }).replace(/\./g, "");

/** "3 – 9 de nov" (multi-day) or "sex, 6 de nov" (a single day). End is exclusive. */
export function formatPeriod(range: PeriodRange): string {
  const last = new Date(range.end.getTime() - 1);
  const sameDay = fmt(range.start, { day: "numeric", month: "numeric" }) === fmt(last, { day: "numeric", month: "numeric" });
  if (sameDay) return fmt(range.start, { weekday: "short", day: "numeric", month: "short" });
  const sameMonth = fmt(range.start, { month: "numeric" }) === fmt(last, { month: "numeric" });
  const startLabel = sameMonth ? fmt(range.start, { day: "numeric" }) : fmt(range.start, { day: "numeric", month: "short" });
  return `${startLabel} – ${fmt(last, { day: "numeric", month: "short" })}`;
}

/** "domingo, 23h59" / "hoje, 23h59": when votes stop (the last minute of the period). */
export function formatDeadline(range: PeriodRange, now: Date): string {
  const last = new Date(range.end.getTime() - 1);
  const time = last
    .toLocaleTimeString("pt-BR", { timeZone: WEEK_TIME_ZONE, hour: "2-digit", minute: "2-digit" })
    .replace(":", "h");
  const today = fmt(now, { day: "numeric", month: "numeric", year: "numeric" }) === fmt(last, { day: "numeric", month: "numeric", year: "numeric" });
  const day = today ? "hoje" : fmt(last, { weekday: "long" });
  return `${day}, ${time}`;
}

export function inPeriod(date: Date, range: PeriodRange): boolean {
  const t = date.getTime();
  return t >= range.start.getTime() && t < range.end.getTime();
}

/** A stored round as a range. */
export const rangeOf = (round: { startsAt: Date; endsAt: Date }): PeriodRange => ({ start: round.startsAt, end: round.endsAt });
