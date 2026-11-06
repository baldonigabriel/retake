// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AiError, createGemini, createGroq, generateWithFallback, providersFromEnv, resetCooldowns, type Attempt, type TextProvider } from ".";

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" }, ...init });

const REQUEST = { system: "sys", prompt: "dados" };

describe("Gemini", () => {
  it("sends the key in a header (never in the URL) and joins the text parts, skipping thoughts", async () => {
    const fetch = vi.fn(async () =>
      json({ candidates: [{ content: { parts: [{ text: "pensando", thought: true }, { text: "Resumo " }, { text: "pronto." }] } }] }),
    );
    const gemini = createGemini({ apiKey: "k-123", fetch });
    await expect(gemini.generate(REQUEST)).resolves.toBe("Resumo pronto.");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent");
    expect(url).not.toContain("k-123");
    expect((init.headers as Record<string, string>)["x-goog-api-key"]).toBe("k-123");
    const body = JSON.parse(init.body as string);
    expect(body.systemInstruction.parts[0].text).toBe("sys");
    expect(body.contents[0].parts[0].text).toBe("dados");
  });

  it("maps 429 with the retry delay from the body", async () => {
    const fetch = vi.fn(async () =>
      json({ error: { code: 429, details: [{ "@type": "type.googleapis.com/google.rpc.RetryInfo", retryDelay: "31s" }] } }, { status: 429 }),
    );
    const error = await createGemini({ apiKey: "k", fetch }).generate(REQUEST).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AiError);
    expect(error).toMatchObject({ provider: "gemini", kind: "rate_limited", retryAfterMs: 31_000 });
  });

  it("reports an empty answer as an invalid response", async () => {
    const fetch = vi.fn(async () => json({ candidates: [{ content: { parts: [] }, finishReason: "SAFETY" }] }));
    await expect(createGemini({ apiKey: "k", fetch }).generate(REQUEST)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("gives up at the timeout", async () => {
    const fetch = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    await expect(createGemini({ apiKey: "k", fetch, timeoutMs: 10 }).generate(REQUEST)).rejects.toMatchObject({ kind: "timeout" });
  });

  it("maps a bad key to auth", async () => {
    const fetch = vi.fn(async () => json({ error: { message: "API key not valid" } }, { status: 400 }));
    await expect(createGemini({ apiKey: "k", fetch }).generate(REQUEST)).rejects.toMatchObject({ kind: "http", status: 400 });
    const forbidden = vi.fn(async () => json({}, { status: 403 }));
    await expect(createGemini({ apiKey: "k", fetch: forbidden }).generate(REQUEST)).rejects.toMatchObject({ kind: "auth" });
  });
});

describe("Groq", () => {
  it("uses the OpenAI-compatible body with low reasoning and no reasoning in the reply", async () => {
    const fetch = vi.fn(async () => json({ choices: [{ message: { role: "assistant", content: "  Texto.  " } }] }));
    await expect(createGroq({ apiKey: "g-1", fetch }).generate(REQUEST)).resolves.toBe("Texto.");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer g-1");
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({ model: "openai/gpt-oss-120b", reasoning_effort: "low", include_reasoning: false });
    expect(body.messages).toEqual([
      { role: "system", content: "sys" },
      { role: "user", content: "dados" },
    ]);
  });

  it("maps 429 with Retry-After in seconds", async () => {
    const fetch = vi.fn(async () => json({}, { status: 429, headers: { "retry-after": "7" } }));
    await expect(createGroq({ apiKey: "g", fetch }).generate(REQUEST)).rejects.toMatchObject({ kind: "rate_limited", retryAfterMs: 7_000 });
  });
});

describe("providersFromEnv", () => {
  it("keeps the order Gemini → Groq and leaves out providers without a key", () => {
    expect(providersFromEnv({}).map((p) => p.id)).toEqual([]);
    expect(providersFromEnv({ GROQ_API_KEY: "g" }).map((p) => p.id)).toEqual(["groq"]);
    expect(providersFromEnv({ GEMINI_API_KEY: "a", GROQ_API_KEY: "b", GROQ_MODEL: "x/y" }).map((p) => `${p.id}:${p.model}`)).toEqual([
      "gemini:gemini-3.5-flash-lite",
      "groq:x/y",
    ]);
  });
});

describe("generateWithFallback", () => {
  beforeEach(() => resetCooldowns());

  const provider = (id: "gemini" | "groq", impl: () => Promise<string>): TextProvider & { calls: number } => {
    const p = {
      id,
      model: `${id}-model`,
      calls: 0,
      async generate() {
        p.calls++;
        return impl();
      },
    };
    return p;
  };

  it("uses the first provider that answers", async () => {
    const gemini = provider("gemini", async () => "do gemini");
    const groq = provider("groq", async () => "do groq");
    await expect(generateWithFallback([gemini, groq], REQUEST)).resolves.toEqual({ text: "do gemini", provider: "gemini", model: "gemini-model" });
    expect(groq.calls).toBe(0);
  });

  it.each([
    ["timeout", new AiError("gemini", "timeout")],
    ["server error", new AiError("gemini", "http", 503)],
    ["bad key", new AiError("gemini", "auth", 401)],
    ["rate limit", new AiError("gemini", "rate_limited", 429, 30_000)],
    ["unexpected crash", new Error("boom")],
  ])("falls back to Groq when Gemini fails (%s), calling each once", async (_, error) => {
    const gemini = provider("gemini", async () => {
      throw error;
    });
    const groq = provider("groq", async () => "do groq");
    const attempts: Attempt[] = [];
    await expect(generateWithFallback([gemini, groq], REQUEST, { attempts })).resolves.toMatchObject({ provider: "groq", text: "do groq" });
    expect(gemini.calls).toBe(1);
    expect(groq.calls).toBe(1);
    expect(attempts.map((a) => a.provider)).toEqual(["gemini", "groq"]);
  });

  it("falls back when a reply is rejected by the caller's check", async () => {
    const gemini = provider("gemini", async () => "inventou 99 vitórias");
    const groq = provider("groq", async () => "certinho");
    const result = await generateWithFallback([gemini, groq], REQUEST, { accept: (t) => (t.includes("99") ? null : t) });
    expect(result?.provider).toBe("groq");
  });

  it("returns null when every provider fails, so the caller uses its own fallback", async () => {
    const fail = async () => {
      throw new AiError("groq", "http", 500);
    };
    await expect(generateWithFallback([provider("gemini", fail), provider("groq", fail)], REQUEST)).resolves.toBeNull();
    await expect(generateWithFallback([], REQUEST)).resolves.toBeNull();
  });

  it("skips a rate-limited provider until its Retry-After has passed (no retry loop)", async () => {
    let t = 1_000_000;
    const now = () => t;
    const gemini = provider("gemini", async () => {
      throw new AiError("gemini", "rate_limited", 429, 30_000);
    });
    const groq = provider("groq", async () => "do groq");
    await generateWithFallback([gemini, groq], REQUEST, { now });
    const attempts: Attempt[] = [];
    await generateWithFallback([gemini, groq], REQUEST, { now, attempts });
    expect(gemini.calls).toBe(1);
    expect(attempts[0]?.outcome).toBe("skipped");
    t += 31_000;
    await generateWithFallback([gemini, groq], REQUEST, { now });
    expect(gemini.calls).toBe(2);
  });
});
