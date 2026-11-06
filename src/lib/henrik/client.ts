/**
 * HenrikDev API client. Server only: the key comes from the environment and
 * this module refuses to run in a browser.
 *
 * Rate limiting (CLAUDE.md › Regras de dados):
 * - Every request goes through a serial queue capped at 20 req/min (the Basic
 *   key allows 30; background Riot fetches also count, so we keep slack).
 * - After each response the X-RateLimit-* headers are read; when the server
 *   window is nearly spent the queue pauses until it resets.
 * - On 429 the queue pauses for Retry-After (or X-RateLimit-Reset) before the
 *   retry. 502/503/504 retry with exponential backoff. Attempts are bounded
 *   and every retry waits — there is no tight retry loop.
 */
import type { z } from "zod";

import { RateLimiter } from "./rate-limiter";
import {
  accountSchema,
  envelope,
  errorBodySchema,
  matchHistorySchema,
  matchSchema,
  mmrHistoryEntrySchema,
  mmrHistorySchema,
  storedMmrHistorySchema,
  type HenrikAccount,
  type HenrikMatch,
  type HenrikMmrEntry,
} from "./schemas";

export const HENRIK_BASE_URL = "https://api.henrikdev.xyz";

/** Local ceiling: 20 requests per rolling minute. */
export const DEFAULT_MAX_PER_MINUTE = 20;
/** Pause when the server reports this many requests left (or fewer). */
export const DEFAULT_MIN_REMAINING = 2;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 20_000;
/** Used on 429 when the server sends no usable wait header. */
const FALLBACK_RETRY_MS = 60_000;
const BACKOFF_BASE_MS = 2_000;

export type Region = "br" | "na" | "latam" | "eu" | "ap" | "kr";
export type Platform = "pc" | "console";

export class HenrikApiError extends Error {
  readonly status: number;
  readonly code: number | undefined;
  readonly requestId: string | undefined;

  constructor(message: string, status: number, code?: number, requestId?: string) {
    super(message);
    this.name = "HenrikApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

/** A history item that failed validation (skipped, not saved). */
export interface InvalidMatch {
  index: number;
  matchId: string | undefined;
  issues: string;
}

export interface HenrikClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  limiter?: RateLimiter;
  maxAttempts?: number;
  minRemaining?: number;
  timeoutMs?: number;
}

/** One queue per process, shared by every client instance. */
let sharedLimiter: RateLimiter | undefined;
function defaultLimiter(): RateLimiter {
  sharedLimiter ??= new RateLimiter({ maxPerWindow: DEFAULT_MAX_PER_MINUTE, windowMs: 60_000 });
  return sharedLimiter;
}

/** Parses Retry-After (seconds or HTTP date) into milliseconds. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - now);
}

function headerSeconds(headers: Headers, name: string): number | undefined {
  const raw = headers.get(name);
  if (raw === null) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
}

export class HenrikClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly limiter: RateLimiter;
  private readonly maxAttempts: number;
  private readonly minRemaining: number;
  private readonly timeoutMs: number;

  constructor(options: HenrikClientOptions) {
    if (typeof window !== "undefined") {
      throw new Error("HenrikClient is server-only");
    }
    if (!options.apiKey) throw new Error("HENRIK_API_KEY is missing");
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? HENRIK_BASE_URL;
    this.fetchImpl = options.fetch ?? fetch;
    this.limiter = options.limiter ?? defaultLimiter();
    this.maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_ATTEMPTS);
    this.minRemaining = options.minRemaining ?? DEFAULT_MIN_REMAINING;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /** Validates a Riot ID and returns its puuid. 404 when it doesn't exist. */
  async getAccount(name: string, tag: string): Promise<HenrikAccount> {
    const path = `/valorant/v2/account/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;
    return this.getJson(path, envelope(accountSchema)).then((r) => r.data);
  }

  /**
   * Recent matches for a puuid (v4 history items are full matches).
   * `size` is capped at 10 by the API. Invalid items are returned apart.
   */
  async getMatchHistory(
    region: Region,
    platform: Platform,
    puuid: string,
    options: { size?: number; start?: number; mode?: string } = {},
  ): Promise<{ matches: HenrikMatch[]; invalid: InvalidMatch[] }> {
    const query = new URLSearchParams({ size: String(options.size ?? 5) });
    if (options.start) query.set("start", String(options.start));
    if (options.mode) query.set("mode", options.mode);
    const path = `/valorant/v4/by-puuid/matches/${region}/${platform}/${encodeURIComponent(puuid)}?${query}`;
    const { data } = await this.getJson(path, matchHistorySchema);

    const matches: HenrikMatch[] = [];
    const invalid: InvalidMatch[] = [];
    data.forEach((item, index) => {
      const parsed = matchSchema.safeParse(item);
      if (parsed.success) {
        matches.push(parsed.data);
      } else {
        invalid.push({ index, matchId: peekMatchId(item), issues: summarize(parsed.error) });
      }
    });
    return { matches, invalid };
  }

  /** Full match by id. */
  async getMatch(region: Region, matchId: string): Promise<HenrikMatch> {
    const path = `/valorant/v4/match/${region}/${encodeURIComponent(matchId)}`;
    return this.getJson(path, envelope(matchSchema)).then((r) => r.data);
  }

  /** Last ~20 competitive RR updates. Invalid entries are dropped. */
  async getMmrHistory(region: Region, platform: Platform, puuid: string): Promise<HenrikMmrEntry[]> {
    const path = `/valorant/v2/by-puuid/mmr-history/${region}/${platform}/${encodeURIComponent(puuid)}`;
    const { data } = await this.getJson(path, envelope(mmrHistorySchema));
    return data.history.flatMap((item) => {
      const parsed = mmrHistoryEntrySchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }

  /**
   * RR history from HenrikDev's stored records (older than the live ~20).
   * Same entry shape as getMmrHistory; invalid entries are dropped. One
   * request, whatever `size` is.
   */
  async getStoredMmrHistory(
    region: Region,
    platform: Platform,
    puuid: string,
    options: { size?: number } = {},
  ): Promise<HenrikMmrEntry[]> {
    const query = options.size ? `?${new URLSearchParams({ size: String(options.size) })}` : "";
    const path = `/valorant/v2/by-puuid/stored-mmr-history/${region}/${platform}/${encodeURIComponent(puuid)}${query}`;
    const { data } = await this.getJson(path, storedMmrHistorySchema);
    return data.flatMap((item) => {
      const parsed = mmrHistoryEntrySchema.safeParse(item);
      return parsed.success ? [parsed.data] : [];
    });
  }

  private async getJson<S extends z.ZodType>(path: string, schema: S): Promise<z.infer<S>> {
    const response = await this.request(path);
    const body: unknown = await response.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      throw new HenrikApiError(
        `Unexpected response shape from ${stripQuery(path)}: ${summarize(parsed.error)}`,
        response.status,
        undefined,
        response.headers.get("x-request-id") ?? undefined,
      );
    }
    return parsed.data;
  }

  private async request(path: string): Promise<Response> {
    for (let attempt = 1; ; attempt++) {
      const response = await this.limiter.schedule(() =>
        this.fetchImpl(this.baseUrl + path, {
          headers: { Authorization: this.apiKey, Accept: "application/json" },
          signal: AbortSignal.timeout(this.timeoutMs),
          cache: "no-store",
        }),
      );
      this.observeRateLimit(response.headers);

      if (response.ok) return response;

      const retryable = response.status === 429 || [502, 503, 504].includes(response.status);
      if (!retryable || attempt >= this.maxAttempts) {
        throw await this.toError(response, path);
      }

      // Wait before retrying: the pause applies to the whole queue.
      if (response.status === 429) {
        const wait =
          parseRetryAfter(response.headers.get("retry-after")) ??
          secondsToMs(headerSeconds(response.headers, "x-ratelimit-reset")) ??
          FALLBACK_RETRY_MS;
        this.limiter.pauseFor(Math.max(wait, 1_000));
      } else {
        this.limiter.pauseFor(BACKOFF_BASE_MS * 2 ** (attempt - 1));
      }
      await response.body?.cancel();
    }
  }

  /** Pauses the queue when the server-side window is nearly spent. */
  private observeRateLimit(headers: Headers): void {
    const remaining = headerSeconds(headers, "x-ratelimit-remaining");
    const reset = headerSeconds(headers, "x-ratelimit-reset");
    if (remaining !== undefined && reset !== undefined && remaining <= this.minRemaining) {
      this.limiter.pauseFor(reset * 1000);
    }
  }

  private async toError(response: Response, path: string): Promise<HenrikApiError> {
    let message = `HenrikDev ${response.status} on ${stripQuery(path)}`;
    let code: number | undefined;
    try {
      const body = errorBodySchema.safeParse(await response.json());
      const first = body.success ? body.data.errors?.[0] : undefined;
      if (first?.message) message = `${message}: ${first.message}`;
      code = first?.code;
    } catch {
      // Non-JSON error body; keep the status message.
    }
    return new HenrikApiError(message, response.status, code, response.headers.get("x-request-id") ?? undefined);
  }
}

function secondsToMs(seconds: number | undefined): number | undefined {
  return seconds === undefined ? undefined : seconds * 1000;
}

function stripQuery(path: string): string {
  return path.split("?")[0]!;
}

function peekMatchId(item: unknown): string | undefined {
  if (item && typeof item === "object" && "metadata" in item) {
    const metadata = (item as { metadata?: { match_id?: unknown } }).metadata;
    return typeof metadata?.match_id === "string" ? metadata.match_id : undefined;
  }
  return undefined;
}

function summarize(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
