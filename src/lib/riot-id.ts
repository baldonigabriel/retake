/** Parses "Name#TAG". Riot names are 3–16 chars, tags 3–5 alphanumerics. */
export function parseRiotId(input: string): { gameName: string; tagLine: string } | null {
  const hash = input.lastIndexOf("#");
  if (hash === -1) return null;
  const gameName = input.slice(0, hash).trim();
  const tagLine = input.slice(hash + 1).trim();
  if (gameName.length < 3 || gameName.length > 16) return null;
  if (!/^[\p{L}\p{N}]{3,5}$/u.test(tagLine)) return null;
  return { gameName, tagLine };
}
