// @vitest-environment node
import { describe, expect, it } from "vitest";

import { RateLimiter, type Clock } from "./rate-limiter";

function fakeClock(): Clock & { sleeps: number[] } {
  let t = 0;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

describe("RateLimiter", () => {
  it("starts at most maxPerWindow tasks per window", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ maxPerWindow: 20, windowMs: 60_000, clock });
    const starts = await Promise.all(Array.from({ length: 25 }, () => limiter.schedule(async () => clock.now())));

    expect(starts.slice(0, 20).every((t) => t === 0)).toBe(true);
    expect(starts.slice(20)).toEqual([60_000, 60_000, 60_000, 60_000, 60_000]);
  });

  it("runs tasks one at a time, in order", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ maxPerWindow: 5, windowMs: 1_000, clock });
    const log: string[] = [];
    await Promise.all(
      [1, 2, 3].map((n) =>
        limiter.schedule(async () => {
          log.push(`start ${n}`);
          await clock.sleep(10);
          log.push(`end ${n}`);
        }),
      ),
    );
    expect(log).toEqual(["start 1", "end 1", "start 2", "end 2", "start 3", "end 3"]);
  });

  it("pauseFor holds the next task", async () => {
    const clock = fakeClock();
    const limiter = new RateLimiter({ maxPerWindow: 20, windowMs: 60_000, clock });
    await limiter.schedule(async () => undefined);
    limiter.pauseFor(7_000);
    const startedAt = await limiter.schedule(async () => clock.now());
    expect(startedAt).toBe(7_000);
  });

  it("a failing task does not block the queue", async () => {
    const limiter = new RateLimiter({ maxPerWindow: 20, windowMs: 60_000, clock: fakeClock() });
    await expect(limiter.schedule(async () => Promise.reject(new Error("boom")))).rejects.toThrow("boom");
    await expect(limiter.schedule(async () => "ok")).resolves.toBe("ok");
  });
});
