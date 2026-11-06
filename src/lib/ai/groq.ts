/**
 * Groq (free plan) via its OpenAI-compatible chat completions.
 * Docs checked 2026-11-06 (console.groq.com/docs): `openai/gpt-oss-120b` is a
 * production model with free-plan limits of 30 RPM / 1K RPD / 8K TPM. It's a
 * reasoning model: `reasoning_effort: "low"` keeps it fast and
 * `include_reasoning: false` keeps the reasoning out of the reply.
 */
import { z } from "zod";

import { AiError, DEFAULT_TIMEOUT_MS, postJson, type ProviderOptions, type TextProvider } from "./types";

export const GROQ_DEFAULT_MODEL = "openai/gpt-oss-120b";
const URL = "https://api.groq.com/openai/v1/chat/completions";

const responseSchema = z
  .object({
    choices: z.array(z.object({ message: z.object({ content: z.string().nullable().optional() }).loose() }).loose()).min(1),
  })
  .loose();

export function createGroq(options: ProviderOptions): TextProvider {
  const model = options.model ?? GROQ_DEFAULT_MODEL;
  const fetchImpl = options.fetch ?? fetch;
  return {
    id: "groq",
    model,
    async generate({ system, prompt, maxOutputTokens = 1024 }) {
      const body = await postJson("groq", URL, {
        headers: { Authorization: `Bearer ${options.apiKey}` },
        body: {
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
          max_completion_tokens: maxOutputTokens,
          reasoning_effort: "low",
          include_reasoning: false,
          temperature: 0.8,
        },
        timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        fetch: fetchImpl,
      });
      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) throw new AiError("groq", "invalid_response");
      const text = parsed.data.choices[0]!.message.content?.trim();
      if (!text) throw new AiError("groq", "invalid_response");
      return text;
    },
  };
}
