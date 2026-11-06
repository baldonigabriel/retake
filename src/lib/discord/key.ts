import { EncryptionKeyError, serverKey } from "@/lib/crypto";

/** The webhook encryption key, or null when it isn't configured (cards are then skipped, not crashed on). */
export function discordKey(): Buffer | null {
  try {
    return serverKey();
  } catch (error) {
    if (error instanceof EncryptionKeyError) {
      console.warn("[discord] ENCRYPTION_KEY missing or invalid: match cards are disabled");
      return null;
    }
    throw error;
  }
}
