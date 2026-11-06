/**
 * Text generation with free providers and a fallback chain. Server only.
 * Order: Gemini (if GEMINI_API_KEY) → Groq (if GROQ_API_KEY). Callers keep a
 * non-AI fallback for when the chain returns null.
 */
import { createGemini } from "./gemini";
import { createGroq } from "./groq";
import type { TextProvider } from "./types";

export * from "./chain";
export * from "./types";
export { GEMINI_DEFAULT_MODEL, createGemini } from "./gemini";
export { GROQ_DEFAULT_MODEL, createGroq } from "./groq";

export interface AiEnv {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
}

/** The configured providers, in fallback order. Empty when no key is set. */
export function providersFromEnv(env: AiEnv, options: { timeoutMs?: number; fetch?: typeof fetch } = {}): TextProvider[] {
  if (typeof window !== "undefined") throw new Error("AI providers are server-only");
  const list: TextProvider[] = [];
  if (env.GEMINI_API_KEY) list.push(createGemini({ apiKey: env.GEMINI_API_KEY, model: env.GEMINI_MODEL, ...options }));
  if (env.GROQ_API_KEY) list.push(createGroq({ apiKey: env.GROQ_API_KEY, model: env.GROQ_MODEL, ...options }));
  return list;
}
