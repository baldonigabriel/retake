/**
 * Google Gemini (free tier) via generateContent.
 * Docs checked 2026-11-06 (aistudio.google.com/docs): `gemini-3.5-flash-lite`
 * is free of charge on the Free Tier and stable; generateContent is "legacy
 * but fully supported" next to the newer Interactions API. Newer models ignore
 * temperature/top_p, so we don't send them.
 */
import { z } from "zod";

import { AiError, DEFAULT_TIMEOUT_MS, postJson, type ProviderOptions, type TextProvider } from "./types";

export const GEMINI_DEFAULT_MODEL = "gemini-3.5-flash-lite";
const BASE = "https://generativelanguage.googleapis.com/v1beta/models";

const responseSchema = z
  .object({
    candidates: z
      .array(
        z
          .object({
            content: z
              .object({ parts: z.array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }).loose()).optional() })
              .loose()
              .optional(),
            finishReason: z.string().optional(),
          })
          .loose(),
      )
      .optional(),
  })
  .loose();

export function createGemini(options: ProviderOptions): TextProvider {
  const model = options.model ?? GEMINI_DEFAULT_MODEL;
  const fetchImpl = options.fetch ?? fetch;
  return {
    id: "gemini",
    model,
    async generate({ system, prompt, maxOutputTokens = 1024 }) {
      const body = await postJson("gemini", `${BASE}/${encodeURIComponent(model)}:generateContent`, {
        headers: { "x-goog-api-key": options.apiKey },
        body: {
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens },
        },
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        fetch: fetchImpl,
      });
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) throw new AiError("gemini", "invalid_response");
      const parts = parsed.data.candidates?.[0]?.content?.parts ?? [];
      const text = parts
        .filter((p) => !p.thought && typeof p.text === "string")
        .map((p) => p.text)
        .join("")
        .trim();
      if (!text) throw new AiError("gemini", "invalid_response");
      return text;
    },
  };
}
