/**
 * The group week: Monday 00:00 to Sunday 23:59:59.999 in America/Sao_Paulo,
 * whatever the server's time zone. Ranges are half-open: [start, end).
 *
 * Brazil has had no daylight saving since 2019, but the offset is looked up
 * with Intl at each instant anyway, so this stays right if that changes.
 */
export const WEEK_TIME_ZONE = "America/Sao_Paulo";

export interface WeekRange {
  start: Date;
  end: Date;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function wallClock(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    year: Number(get("year")),
    month: Number(get("month")),
    day: Number(get("day")),
    /** 0 = Monday … 6 = Sunday */
    weekday: WEEKDAYS.indexOf(get("weekday")),
  };
}

/** UTC offset of `timeZone` at `date`, in ms ("GMT-03:00" → -10_800_000). */
function offsetMs(date: Date, timeZone: string): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3]);
  return (match[1] === "-" ? -1 : 1) * minutes * 60_000;
}

/** The instant when the wall clock in `timeZone` reads year-month-day 00:00. */
function localMidnight(year: number, month: number, day: number, timeZone: string): Date {
  const wall = Date.UTC(year, month - 1, day);
  const guess = wall - offsetMs(new Date(wall), timeZone);
  return new Date(wall - offsetMs(new Date(guess), timeZone));
}

/** The Monday–Sunday week containing `now`. */
export function weekRange(now: Date, timeZone = WEEK_TIME_ZONE): WeekRange {
  const { year, month, day, weekday } = wallClock(now, timeZone);
  return {
    start: localMidnight(year, month, day - weekday, timeZone),
    end: localMidnight(year, month, day - weekday + 7, timeZone),
  };
}

/** The week before `week`. */
export function previousWeek(week: WeekRange, timeZone = WEEK_TIME_ZONE): WeekRange {
  // Any instant in the previous week works; noon on the Sunday before is safe.
  return weekRange(new Date(week.start.getTime() - 12 * 3_600_000), timeZone);
}

export function inWeek(date: Date, week: WeekRange): boolean {
  const t = date.getTime();
  return t >= week.start.getTime() && t < week.end.getTime();
}

export const WEEKS = ["current", "last"] as const;
export type WeekChoice = (typeof WEEKS)[number];

export function parseWeek(value: unknown): WeekChoice {
  return value === "last" ? "last" : "current";
}

/** "3 – 9 de nov." in São Paulo time (end is exclusive, so Sunday is end − 1 ms). */
export function formatWeek(week: WeekRange, timeZone = WEEK_TIME_ZONE): string {
  const fmt = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString("pt-BR", { timeZone, ...opts });
  const last = new Date(week.end.getTime() - 1);
  const sameMonth = fmt(week.start, { month: "numeric" }) === fmt(last, { month: "numeric" });
  const startLabel = sameMonth ? fmt(week.start, { day: "numeric" }) : fmt(week.start, { day: "numeric", month: "short" });
  return `${startLabel} – ${fmt(last, { day: "numeric", month: "short" })}`.replace(/\./g, "");
}
