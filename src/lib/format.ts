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

/** Matches are shown in Brazil's time zone regardless of the server's. */
export const DISPLAY_TIME_ZONE = "America/Sao_Paulo";

/** "5 de nov. de 2026, 21:03" (pt-BR, São Paulo time) */
export function formatMatchDate(date: Date): string {
  return date.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: DISPLAY_TIME_ZONE,
  });
}

/** Time played: 2_700_000 → "45 min", 5_400_000 → "1,5 h", 0 → "0 min". */
export function formatHours(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0 min";
  if (ms < 3_600_000) return `${Math.max(1, Math.round(ms / 60_000))} min`;
  return `${formatNumber(ms / 3_600_000, 1)} h`;
}
