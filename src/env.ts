import { z } from "zod";

/**
 * Server-only environment, validated with Zod on first access (lazy, so
 * `next build` and tests don't require secrets that aren't used yet).
 * Never import this from a client component.
 */
const serverSchema = z.object({
  DATABASE_URL: z.url(),
  DATABASE_URL_POOLED: z.url().optional(),
  BETTER_AUTH_SECRET: z.string().min(32).optional(),
  BETTER_AUTH_URL: z.url().optional(),
  DISCORD_CLIENT_ID: z.string().min(1).optional(),
  DISCORD_CLIENT_SECRET: z.string().min(1).optional(),
  HENRIK_API_KEY: z.string().min(1).optional(),
  CRON_SECRET: z.string().min(16).optional(),
  WEBHOOK_ENCRYPTION_KEY: z.string().min(32).optional(),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

export function serverEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("serverEnv() must not be called in the browser");
  }
  if (!cached) {
    // `KEY=` (empty) in .env files means "not set yet", not an invalid value.
    const present = Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== ""));
    const parsed = serverSchema.safeParse(present);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid or missing environment variables: ${fields}. See .env.example.`);
    }
    cached = parsed.data;
  }
  return cached;
}
