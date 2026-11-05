// @vitest-environment node
import { describe, expect, it } from "vitest";

import { HenrikApiError, HenrikClient, parseRetryAfter } from "./client";
import { ME_PUUID, rawMatch, rawMmrEntry } from "./fixtures";
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

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

function setup(replies: Reply[]) {
  const clock = fakeClock();
  const limiter = new RateLimiter({ maxPerWindow: 20, windowMs: 60_000, clock });
  const calls: { url: string; auth: string | null; at: number }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), auth: new Headers(init?.headers).get("authorization"), at: clock.now() });
    const reply = replies.shift();
    if (!reply) throw new Error("unexpected request");
    return new Response(JSON.stringify(reply.body ?? {}), {
      status: reply.status ?? 200,
      headers: { "content-type": "application/json", ...reply.headers },
    });
  };
  const client = new HenrikClient({ apiKey: "test-key", fetch: fetchImpl, limiter });
  return { client, calls, clock };
}

const account = {
  status: 200,
  data: { puuid: ME_PUUID, region: "na", account_level: 286, name: "Tester", tag: "TST", card: "c1", extra: 1 },
};

describe("HenrikClient", () => {
  it("sends the key and strips unknown fields", async () => {
    const { client, calls } = setup([{ body: account }]);
    const result = await client.getAccount("p12 o tal", "p12");

    expect(calls[0]!.url).toBe("https://api.henrikdev.xyz/valorant/v2/account/p12%20o%20tal/p12");
    expect(calls[0]!.auth).toBe("test-key");
    expect(result).toEqual({ puuid: ME_PUUID, region: "na", account_level: 286, name: "Tester", tag: "TST", card: "c1" });
  });

  it("waits Retry-After on 429 before retrying", async () => {
    const { client, calls } = setup([
      { status: 429, headers: { "retry-after": "7" }, body: { errors: [{ message: "Rate limited" }] } },
      { body: account },
    ]);
    await expect(client.getAccount("Tester", "TST")).resolves.toMatchObject({ puuid: ME_PUUID });
    expect(calls.map((c) => c.at)).toEqual([0, 7_000]);
  });

  it("falls back to X-RateLimit-Reset when Retry-After is missing", async () => {
    const { client, calls } = setup([
      { status: 429, headers: { "x-ratelimit-reset": "12" } },
      { body: account },
    ]);
    await client.getAccount("Tester", "TST");
    expect(calls.map((c) => c.at)).toEqual([0, 12_000]);
  });

  it("gives up after the attempt limit, waiting between every try", async () => {
    const limited = { status: 429, headers: { "retry-after": "5" } };
    const { client, calls } = setup([limited, limited, limited]);
    const error = await client.getAccount("Tester", "TST").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(HenrikApiError);
    expect((error as HenrikApiError).status).toBe(429);
    expect(calls.map((c) => c.at)).toEqual([0, 5_000, 10_000]);
  });

  it("does not retry a 404 and surfaces the API message", async () => {
    const { client, calls } = setup([{ status: 404, body: { status: 404, errors: [{ message: "Account not found", code: 22 }] } }]);
    const error = (await client.getAccount("Nobody", "000").catch((e: unknown) => e)) as HenrikApiError;

    expect(calls).toHaveLength(1);
    expect(error.status).toBe(404);
    expect(error.code).toBe(22);
    expect(error.message).toContain("Account not found");
  });

  it("pauses the queue when the server window is nearly spent", async () => {
    const { client, calls } = setup([
      { body: account, headers: { "x-ratelimit-remaining": "1", "x-ratelimit-reset": "30" } },
      { body: account },
    ]);
    await client.getAccount("Tester", "TST");
    await client.getAccount("Tester", "TST");
    expect(calls.map((c) => c.at)).toEqual([0, 30_000]);
  });

  it("keeps valid history items and reports the invalid ones", async () => {
    const broken = rawMatch({ matchId: "broken" }) as Record<string, unknown>;
    delete broken.players;
    const { client, calls } = setup([{ body: { status: 200, data: [rawMatch(), broken] } }]);
    const { matches, invalid } = await client.getMatchHistory("br", "pc", ME_PUUID, { size: 5 });

    expect(calls[0]!.url).toBe(`https://api.henrikdev.xyz/valorant/v4/by-puuid/matches/br/pc/${ME_PUUID}?size=5`);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.players).toHaveLength(10);
    expect(matches[0]!.metadata).not.toHaveProperty("some_future_field");
    expect(invalid).toEqual([{ index: 1, matchId: "broken", issues: expect.stringContaining("players") }]);
  });

  it("parses MMR history and drops malformed entries", async () => {
    const good = rawMmrEntry("m1", 12, -16, "2026-11-05T03:20:02.377Z");
    const { client } = setup([{ body: { status: 200, data: { account: {}, history: [good, { rr: "x" }] } } }]);
    const entries = await client.getMmrHistory("br", "pc", ME_PUUID);
    expect(entries).toEqual([
      { match_id: "m1", tier: { id: 21, name: "Ascendant 1" }, rr: 12, last_change: -16, elo: 1812, date: good.date, queue_id: "competitive" },
    ]);
  });
});

describe("parseRetryAfter", () => {
  it("reads seconds and HTTP dates", () => {
    expect(parseRetryAfter("3")).toBe(3_000);
    expect(parseRetryAfter(new Date(10_000).toUTCString(), 4_000)).toBe(6_000);
    expect(parseRetryAfter(null)).toBeUndefined();
    expect(parseRetryAfter("soon")).toBeUndefined();
  });
});
