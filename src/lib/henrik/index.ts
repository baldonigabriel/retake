import { serverEnv } from "@/env";

import { HenrikClient } from "./client";

export * from "./client";
export * from "./rate-limiter";
export type { HenrikAccount, HenrikMatch, HenrikMatchPlayer, HenrikMmrEntry } from "./schemas";

let instance: HenrikClient | undefined;

/** Process-wide client built from HENRIK_API_KEY (server only). */
export function henrikClient(): HenrikClient {
  if (!instance) {
    const apiKey = serverEnv().HENRIK_API_KEY;
    if (!apiKey) throw new Error("HENRIK_API_KEY is not set. See .env.example.");
    instance = new HenrikClient({ apiKey });
  }
  return instance;
}

/** Community asset URL for a player card id (SPEC §1). */
export function playerCardUrl(cardId: string | null | undefined): string | null {
  return cardId ? `https://media.valorant-api.com/playercards/${cardId}/smallart.png` : null;
}
