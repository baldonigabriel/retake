/**
 * Fallback chain: try each provider once, in order, and take the first reply
 * that passes `accept`. No provider is ever retried in a loop:
 * - a failure (timeout, 5xx, bad key, invalid body) moves to the next one;
 * - a 429 also moves on, and the provider is skipped until its Retry-After
 *   has passed (remembered for this server instance), so the next group in
 *   the same run doesn't hit the limit again.
 * When nothing works the caller gets `null` and uses its own fallback (rules).
 */
import { AiError, type ProviderId, type TextProvider, type TextRequest } from "./types";

export interface Attempt {
  provider: ProviderId;
  model: string;
  outcome: "ok" | "rejected" | "skipped" | AiError["kind"] | "error";
}

export interface ChainResult {
  text: string;
  provider: ProviderId;
  model: string;
}

/** Without a Retry-After, a 429'd provider rests this long. */
const DEFAULT_COOLDOWN_MS = 60_000;
const coolingUntil = new Map<ProviderId, number>();

export function resetCooldowns(): void {
  coolingUntil.clear();
}

export async function generateWithFallback(
  providers: readonly TextProvider[],
  request: TextRequest,
  options: { accept?: (text: string) => string | null; now?: () => number; attempts?: Attempt[] } = {},
): Promise<ChainResult | null> {
  const now = options.now ?? Date.now;
  const accept = options.accept ?? ((t: string) => t);
  const log = options.attempts ?? [];

  for (const provider of providers) {
    const until = coolingUntil.get(provider.id) ?? 0;
    if (until > now()) {
      log.push({ provider: provider.id, model: provider.model, outcome: "skipped" });
      continue;
    }
    try {
      const raw = await provider.generate(request);
      const text = accept(raw);
      if (text === null) {
        log.push({ provider: provider.id, model: provider.model, outcome: "rejected" });
        continue;
      }
      log.push({ provider: provider.id, model: provider.model, outcome: "ok" });
      return { text, provider: provider.id, model: provider.model };
    } catch (error) {
      if (error instanceof AiError) {
        if (error.kind === "rate_limited") coolingUntil.set(provider.id, now() + (error.retryAfterMs ?? DEFAULT_COOLDOWN_MS));
        log.push({ provider: provider.id, model: provider.model, outcome: error.kind });
      } else {
        log.push({ provider: provider.id, model: provider.model, outcome: "error" });
      }
    }
  }
  return null;
}
