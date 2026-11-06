/**
 * Discord webhook sender. Server only (the URL is a secret: whoever has it can
 * post in the channel).
 *
 * Rate limits (https://discord.com/developers/docs/topics/rate-limits):
 * - On 429 we wait for Retry-After (header, seconds) or the body's
 *   `retry_after` before the next attempt. If the wait is longer than we can
 *   afford, we stop and report it as retryable: the next sync run tries again.
 * - When a response says the bucket is empty (X-RateLimit-Remaining: 0), the
 *   next post to the same webhook waits for X-RateLimit-Reset-After first.
 * - 5xx and network errors retry with a short backoff. Attempts are bounded
 *   and every retry waits: no tight loops.
 */
import { z } from "zod";

import type { WebhookPayload } from "./card";

export type WebhookErrorKind = "rate_limited" | "not_found" | "unauthorized" | "bad_request" | "server" | "network";

export class DiscordWebhookError extends Error {
  constructor(
    readonly kind: WebhookErrorKind,
    readonly status: number | null,
    /** Worth trying again later (in the next sync run). */
    readonly retryable: boolean,
    readonly retryAfterMs?: number,
  ) {
    super(`discord webhook ${kind}${status ? ` (${status})` : ""}`);
    this.name = "DiscordWebhookError";
  }
}

export interface PostOptions {
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  maxAttempts?: number;
  /** Longest single wait we accept before giving up for this run. */
  maxWaitMs?: number;
  timeoutMs?: number;
}

const DEFAULTS = { maxAttempts: 3, maxWaitMs: 10_000, timeoutMs: 10_000 };
const BACKOFF_MS = 1_000;

const messageSchema = z.object({ id: z.string() }).loose();
const rateLimitBodySchema = z.object({ retry_after: z.number().nonnegative() }).loose();

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Per-webhook "don't post before" instants, from X-RateLimit-Reset-After. */
const notBefore = new Map<string, number>();

/** Seconds (possibly fractional) → ms. */
function secondsHeader(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.ceil(n * 1000) : undefined;
}

async function retryAfterOf(response: Response): Promise<number | undefined> {
  const header = secondsHeader(response.headers, "retry-after");
  if (header !== undefined) return header;
  try {
    const body = rateLimitBodySchema.safeParse(await response.json());
    if (body.success) return Math.ceil(body.data.retry_after * 1000);
  } catch {
    // Not JSON: fall through.
  }
  return secondsHeader(response.headers, "x-ratelimit-reset-after");
}

function kindOf(status: number): WebhookErrorKind {
  if (status === 404) return "not_found";
  if (status === 401 || status === 403) return "unauthorized";
  if (status >= 500) return "server";
  return "bad_request";
}

/** Posts the payload. Resolves with Discord's message id (null if Discord didn't return one). */
export async function postWebhook(url: string, payload: WebhookPayload, options: PostOptions = {}): Promise<{ messageId: string | null }> {
  if (typeof window !== "undefined") throw new Error("postWebhook is server-only");
  const fetchImpl = options.fetch ?? fetch;
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULTS.maxAttempts);
  const maxWaitMs = options.maxWaitMs ?? DEFAULTS.maxWaitMs;
  const timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;

  const target = new URL(url);
  target.searchParams.set("wait", "true");
  const bucketKey = `${target.origin}${target.pathname}`;

  for (let attempt = 1; ; attempt++) {
    const ready = notBefore.get(bucketKey) ?? 0;
    const pause = ready - now();
    if (pause > 0) {
      if (pause > maxWaitMs) throw new DiscordWebhookError("rate_limited", 429, true, pause);
      await sleep(pause);
    }

    let response: Response;
    try {
      response = await fetchImpl(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      });
    } catch {
      if (attempt >= maxAttempts) throw new DiscordWebhookError("network", null, true);
      await sleep(BACKOFF_MS * 2 ** (attempt - 1));
      continue;
    }

    if (response.headers.get("x-ratelimit-remaining") === "0") {
      const reset = secondsHeader(response.headers, "x-ratelimit-reset-after");
      if (reset !== undefined) notBefore.set(bucketKey, now() + reset);
    }

    if (response.ok) {
      if (response.status === 204) return { messageId: null };
      const body = messageSchema.safeParse(await response.json().catch(() => null));
      return { messageId: body.success ? body.data.id : null };
    }

    if (response.status === 429) {
      const wait = (await retryAfterOf(response)) ?? maxWaitMs + 1;
      notBefore.set(bucketKey, now() + wait);
      if (attempt >= maxAttempts || wait > maxWaitMs) throw new DiscordWebhookError("rate_limited", 429, true, wait);
      continue; // the top of the loop waits for notBefore
    }

    const kind = kindOf(response.status);
    if (kind === "server" && attempt < maxAttempts) {
      await sleep(BACKOFF_MS * 2 ** (attempt - 1));
      continue;
    }
    throw new DiscordWebhookError(kind, response.status, kind === "server");
  }
}

/** Test hook: forget remembered rate-limit windows. */
export function resetWebhookBuckets(): void {
  notBefore.clear();
}
