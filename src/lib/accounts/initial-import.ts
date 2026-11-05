/**
 * First import after linking (SPEC §3: "importar as partidas que a API
 * retornar no histórico recente e mostrar o progresso na tela").
 *
 * The client asks for one history page at a time so it can show progress.
 * The server caps it: at most IMPORT_PAGES pages of IMPORT_PAGE_SIZE, and
 * only shortly after linking, so the action can't be used to hammer the API.
 * Each page costs 1 request plus 1 per match the HenrikDev cache lacks; the
 * client's rate limiter (20 req/min, reads X-RateLimit-*) paces the rest.
 */
import type { RiotAccount } from "@/db/schema";

export const IMPORT_PAGE_SIZE = 5;
export const IMPORT_PAGES = 4;
export const IMPORT_LIMIT = IMPORT_PAGE_SIZE * IMPORT_PAGES;
/** How long after linking the paged import stays open. */
export const IMPORT_WINDOW_MS = 15 * 60_000;

export function canImportPage(
  account: Pick<RiotAccount, "linkedAt">,
  page: number,
  now: Date,
): boolean {
  if (!Number.isInteger(page) || page < 0 || page >= IMPORT_PAGES) return false;
  if (!account.linkedAt) return false;
  const age = now.getTime() - account.linkedAt.getTime();
  return age >= 0 && age <= IMPORT_WINDOW_MS;
}

/** A short page means the history ended: no point asking for the next one. */
export function isLastPage(page: number, fetched: number): boolean {
  return fetched < IMPORT_PAGE_SIZE || page >= IMPORT_PAGES - 1;
}

/** "Sincronizar agora" cooldown (SPEC §3): 2 minutes per account. */
export const SYNC_NOW_COOLDOWN_MS = 2 * 60_000;

/** Milliseconds left before a manual sync is allowed again (0 = allowed). */
export function syncCooldownLeft(account: Pick<RiotAccount, "lastSyncedAt">, now: Date): number {
  if (!account.lastSyncedAt) return 0;
  return Math.max(0, account.lastSyncedAt.getTime() + SYNC_NOW_COOLDOWN_MS - now.getTime());
}
