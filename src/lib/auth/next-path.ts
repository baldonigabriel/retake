/**
 * Sanitises the `?next=` target used after login: only same-origin relative
 * paths are allowed (no "//evil.com", no "https://", no backslash tricks).
 */
export function safeNextPath(value: string | string[] | null | undefined, fallback = "/me"): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
