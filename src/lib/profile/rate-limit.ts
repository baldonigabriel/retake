/**
 * Simple fixed-window limiter per key (the client IP for the profile search,
 * SPEC §6.4). In memory, so it's per server instance: enough to keep the
 * search from being used to walk the user list, not a security boundary.
 */
export class WindowLimiter {
  private readonly hits = new Map<string, { start: number; count: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
    /** Bounded so a flood of distinct keys can't grow memory forever. */
    private readonly maxKeys = 5_000,
  ) {}

  /** Counts a hit; false when the key already used its quota in this window. */
  take(key: string, now: number): boolean {
    const entry = this.hits.get(key);
    if (!entry || now - entry.start >= this.windowMs) {
      if (!entry && this.hits.size >= this.maxKeys) this.prune(now);
      this.hits.set(key, { start: now, count: 1 });
      return true;
    }
    if (entry.count >= this.limit) return false;
    entry.count += 1;
    return true;
  }

  private prune(now: number) {
    for (const [key, entry] of this.hits) if (now - entry.start >= this.windowMs) this.hits.delete(key);
    // Still full: drop the oldest entries (Map keeps insertion order).
    for (const key of this.hits.keys()) {
      if (this.hits.size < this.maxKeys) break;
      this.hits.delete(key);
    }
  }
}

/** First address in x-forwarded-for (set by Vercel), else x-real-ip, else a shared bucket. */
export function clientIp(get: (name: string) => string | null): string {
  const forwarded = get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || get("x-real-ip")?.trim() || "unknown";
}
