/**
 * Sync a single Riot ID from the terminal (debug).
 *   pnpm sync:once "Nome#TAG"
 *
 * Phase 0 stub: validates the argument only. The real sync (HenrikDev client,
 * Zod schemas, rate limiter, upserts) lands in Phase 1 under src/lib/sync/.
 */
import { parseRiotId } from "../src/lib/riot-id";

const input = process.argv[2];
const riotId = input ? parseRiotId(input) : null;

if (!riotId) {
  console.error('Uso: pnpm sync:once "Nome#TAG"');
  process.exit(1);
}

console.log(`Riot ID válido: ${riotId.gameName}#${riotId.tagLine}`);
console.log("A sincronização chega na Fase 1 (src/lib/sync/).");
