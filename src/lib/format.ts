/** pt-BR number and time formatting for stats. */

const LOCALE = "pt-BR";

export function formatNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString(LOCALE, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

/** 0.2345 → "23,5%" */
export function formatPercent(ratio: number, fractionDigits = 1): string {
  return `${formatNumber(ratio * 100, fractionDigits)}%`;
}

/** 2.1 → "+2,1", -0.4 → "−0,4" (true minus sign), 0 → "0,0" */
export function formatSigned(value: number, fractionDigits = 1): string {
  const abs = formatNumber(Math.abs(value), fractionDigits);
  if (Number(abs.replace(",", ".")) === 0) return abs;
  return value > 0 ? `+${abs}` : `−${abs}`;
}

/** "há 2 h"-style relative time. `now` is injected to keep it pure and testable. */
export function formatRelativeTime(date: Date, now: Date): string {
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return "agora";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `há ${days} d`;
  return date.toLocaleDateString(LOCALE, { day: "numeric", month: "short" }).replace(".", "");
}

/** 2_154_000 ms → "35:54" */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
