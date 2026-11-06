// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

import { buildTestCard } from "./card";
import { DiscordWebhookError, postWebhook, resetWebhookBuckets } from "./webhook";

const URL = "https://discord.com/api/webhooks/123456789012345678/token_abc";
const payload = buildTestCard({ groupName: "G", now: new Date(0) });

/** Fake clock where sleeping moves time forward. */
function clock() {
  let t = 1_000_000;
  const sleeps: number[] = [];
  return {
    now: () => t,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      t += ms;
    },
    sleeps,
  };
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });

afterEach(() => resetWebhookBuckets());

describe("postWebhook", () => {
  it("posts JSON with ?wait=true and returns the message id", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(200, { id: "999", extra: true }));
    const c = clock();
    await expect(postWebhook(URL, payload, { fetch, ...c })).resolves.toEqual({ messageId: "999" });
    const [target, init] = fetch.mock.calls[0]!;
    expect(String(target)).toBe(`${URL}?wait=true`);
    expect(init?.method).toBe("POST");
    expect(JSON.parse(String(init?.body))).toMatchObject({ username: "Retake", allowed_mentions: { parse: [] } });
  });

  it("waits for Retry-After on 429 before trying again", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json(429, { retry_after: 9 }, { "Retry-After": "2" }))
      .mockResolvedValueOnce(json(200, { id: "1" }));
    const c = clock();
    await expect(postWebhook(URL, payload, { fetch, ...c })).resolves.toEqual({ messageId: "1" });
    expect(c.sleeps).toEqual([2000]);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("falls back to the body's retry_after (fractional seconds)", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(json(429, { retry_after: 0.35, global: false }))
      .mockResolvedValueOnce(json(200, { id: "1" }));
    const c = clock();
    await postWebhook(URL, payload, { fetch, ...c });
    expect(c.sleeps).toEqual([350]);
  });

  it("gives up (retryable) instead of waiting longer than allowed", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(429, {}, { "Retry-After": "60" }));
    const c = clock();
    const error = await postWebhook(URL, payload, { fetch, ...c, maxWaitMs: 10_000 }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(DiscordWebhookError);
    expect(error).toMatchObject({ kind: "rate_limited", retryable: true, retryAfterMs: 60_000 });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(c.sleeps).toEqual([]);
  });

  it("never retries without waiting, and stops after maxAttempts", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(429, {}, { "Retry-After": "1" }));
    const c = clock();
    await expect(postWebhook(URL, payload, { fetch, ...c, maxAttempts: 3 })).rejects.toMatchObject({ kind: "rate_limited" });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(c.sleeps).toEqual([1000, 1000]);
  });

  it("waits for an empty bucket's reset before the next post to the same webhook", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () =>
      json(200, { id: "1" }, { "X-RateLimit-Remaining": "0", "X-RateLimit-Reset-After": "1.5" }),
    );
    const c = clock();
    await postWebhook(URL, payload, { fetch, ...c });
    await postWebhook(URL, payload, { fetch, ...c });
    expect(c.sleeps).toEqual([1500]);
  });

  it("reports a deleted webhook as permanent", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(async () => json(404, { code: 10015, message: "Unknown Webhook" }));
    await expect(postWebhook(URL, payload, { fetch, ...clock() })).rejects.toMatchObject({ kind: "not_found", retryable: false });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("retries 5xx and network errors with backoff, then reports them as retryable", async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(json(502, {}))
      .mockResolvedValueOnce(json(503, {}));
    const c = clock();
    await expect(postWebhook(URL, payload, { fetch, ...c })).rejects.toMatchObject({ kind: "server", retryable: true });
    expect(c.sleeps).toEqual([1000, 2000]);
  });
});
