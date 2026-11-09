/**
 * Public profile search (SPEC §6.4): parsing the query and the rules that
 * keep it from turning into a scraping tool. Pure; the SQL lives in
 * queries.ts.
 */

export const SEARCH_MIN_CHARS = 3;
export const SEARCH_LIMIT = 10;
/** Longest input we even look at (Riot names are ≤16 chars, tags ≤5). */
const MAX_QUERY = 40;

const FROM = "áàâãäåāéèêëēíìîïīóòôõöøōúùûüūçñýÿ";
const TO = "aaaaaaaeeeeeiiiiiooooooouuuuucnyy";

/**
 * Lowercase + the same accent folding as the SQL function `retake_fold`
 * (migration 0013). Keep both tables in sync.
 */
export function foldName(value: string): string {
  let out = "";
  for (const ch of value.toLowerCase()) {
    const i = FROM.indexOf(ch);
    out += i === -1 ? ch : TO[i];
  }
  return out;
}

export type SearchQuery =
  | { kind: "empty" }
  | { kind: "too_short"; text: string }
  | { kind: "ok"; text: string; name: string; tag: string | null };

/** "Nome", "nome#", "Nome#TA" → folded name (+ tag prefix when there's a #). */
export function parseSearchQuery(raw: unknown): SearchQuery {
  const input = (Array.isArray(raw) ? raw[0] : raw) as unknown;
  if (typeof input !== "string") return { kind: "empty" };
  const text = input.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
  if (text.length === 0) return { kind: "empty" };
  const hash = text.lastIndexOf("#");
  const name = (hash === -1 ? text : text.slice(0, hash)).trim();
  const tag = hash === -1 ? null : text.slice(hash + 1).replace(/[^\p{L}\p{N}]/gu, "");
  if ([...name].length < SEARCH_MIN_CHARS) return { kind: "too_short", text };
  return { kind: "ok", text, name: foldName(name), tag: tag ? foldName(tag) : null };
}

/** Escapes LIKE wildcards so "a_b%" matches literally (used with ESCAPE '\'). */
export function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/** Exact name first, then names that start with the query, then the rest; ties by name. */
export function rankResults<T extends { gameName: string; tagLine: string }>(rows: readonly T[], name: string): T[] {
  const score = (row: T) => {
    const folded = foldName(row.gameName);
    return folded === name ? 0 : folded.startsWith(name) ? 1 : 2;
  };
  return [...rows].sort(
    (a, b) => score(a) - score(b) || foldName(a.gameName).localeCompare(foldName(b.gameName)) || a.tagLine.localeCompare(b.tagLine),
  );
}
