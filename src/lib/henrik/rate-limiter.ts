/**
 * Serial request queue with a sliding-window ceiling.
 *
 * - Tasks run one at a time, in arrival order.
 * - At most `maxPerWindow` tasks start within any `windowMs` window.
 * - `pauseFor()` blocks every queued task until the pause ends (used for
 *   429 Retry-After and when the server says the window is almost empty).
 *
 * The clock is injectable so tests run without real waits.
 */

export interface Clock {
  now(): number;
  sleep(ms: number): Promise<void>;
}

export const realClock: Clock = {
  now: () => Date.now(),
  sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};

export interface RateLimiterOptions {
  maxPerWindow: number;
  windowMs: number;
  clock?: Clock;
}

export class RateLimiter {
  private readonly maxPerWindow: number;
  private readonly windowMs: number;
  private readonly clock: Clock;
  private readonly starts: number[] = [];
  private pausedUntil = 0;
  private tail: Promise<unknown> = Promise.resolve();

  constructor(options: RateLimiterOptions) {
    if (options.maxPerWindow < 1) throw new Error("maxPerWindow must be >= 1");
    this.maxPerWindow = options.maxPerWindow;
    this.windowMs = options.windowMs;
    this.clock = options.clock ?? realClock;
  }

  /** Queues `task`; resolves or rejects with the task's own result. */
  schedule<T>(task: () => Promise<T>): Promise<T> {
    const run = this.tail.then(async () => {
      await this.acquire();
      return task();
    });
    // A failed task must not block the ones queued after it.
    this.tail = run.catch(() => undefined);
    return run;
  }

  /** Holds every queued task for at least `ms` from now. */
  pauseFor(ms: number): void {
    if (ms <= 0) return;
    this.pausedUntil = Math.max(this.pausedUntil, this.clock.now() + ms);
  }

  /** Milliseconds until the next task could start (0 = now). */
  waitTime(): number {
    const now = this.clock.now();
    this.prune(now);
    const pauseWait = this.pausedUntil - now;
    const windowWait =
      this.starts.length >= this.maxPerWindow ? this.starts[0]! + this.windowMs - now : 0;
    return Math.max(0, pauseWait, windowWait);
  }

  private async acquire(): Promise<void> {
    for (;;) {
      const wait = this.waitTime();
      if (wait <= 0) {
        this.starts.push(this.clock.now());
        return;
      }
      await this.clock.sleep(wait);
    }
  }

  private prune(now: number): void {
    while (this.starts.length > 0 && this.starts[0]! <= now - this.windowMs) {
      this.starts.shift();
    }
  }
}
