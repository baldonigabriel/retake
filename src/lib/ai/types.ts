/**
 * Common interface for text providers (src/lib/ai). Server only: providers
 * hold API keys. Adding a provider = one file that returns a TextProvider,
 * plus one line in `providersFromEnv`; nothing else changes.
 */

export type ProviderId = "gemini" | "groq";

export interface TextRequest {
  /** System instruction (tone, rules). */
  system: string;
  /** The user message (here: the week's aggregated numbers). */
  prompt: string;
  /** Upper bound for the reply. */
  maxOutputTokens?: number;
}

export interface TextProvider {
  id: ProviderId;
  model: string;
  /** Resolves with the reply text, or throws AiError. Never retries on its own. */
  generate(request: TextRequest): Promise<string>;
}

export type AiErrorKind =
  /** 429: quota or rate limit. `retryAfterMs` when the provider said how long. */
  | "rate_limited"
  | "timeout"
  /** 401/403: bad or missing key. */
  | "auth"
  /** Other 4xx/5xx. */
  | "http"
  | "network"
  /** 2xx with a body we don't understand, or no text in it. */
  | "invalid_response";

export class AiError extends Error {
  constructor(
    readonly provider: ProviderId,
    readonly kind: AiErrorKind,
    readonly status: number | null = null,
    readonly retryAfterMs?: number,
  ) {
    super(`${provider} ${kind}${status ? ` (${status})` : ""}`);
    this.name = "AiError";
  }
}

export interface ProviderOptions {
  apiKey: string;
  model?: string;
  /** Short on purpose: a summary isn't worth waiting for. */
  timeoutMs?: number;
  fetch?: typeof fetch;
}

export const DEFAULT_TIMEOUT_MS = 8_000;

/** Seconds (integer or "30s"/"1.5s" duration strings) → ms. */
export function parseSeconds(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const n = Number(value.trim().replace(/s$/, ""));
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n * 1000) : undefined;
}

/** Shared fetch with timeout and error mapping; returns the parsed JSON body. */
export async function postJson(
  provider: ProviderId,
  url: string,
  init: { headers: Record<string, string>; body: unknown; timeoutMs: number; fetch: typeof fetch },
): Promise<unknown> {
  let response: Response;
  try {
    response = await init.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...init.headers },
      body: JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs),
      cache: "no-store",
    });
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    throw new AiError(provider, name === "TimeoutError" || name === "AbortError" ? "timeout" : "network");
  }

  if (response.status === 429) {
    let retryAfterMs = parseSeconds(response.headers.get("retry-after"));
    if (retryAfterMs === undefined) {
      // Gemini puts it in the body: error.details[].retryDelay = "31s".
      const body = await response.json().catch(() => null);
      const details = (body as { error?: { details?: { retryDelay?: string }[] } } | null)?.error?.details ?? [];
      retryAfterMs = parseSeconds(details.find((d) => typeof d?.retryDelay === "string")?.retryDelay);
    }
    throw new AiError(provider, "rate_limited", 429, retryAfterMs);
  }
  if (response.status === 401 || response.status === 403) throw new AiError(provider, "auth", response.status);
  if (!response.ok) throw new AiError(provider, "http", response.status);

  try {
    return await response.json();
  } catch {
    throw new AiError(provider, "invalid_response", response.status);
  }
}
