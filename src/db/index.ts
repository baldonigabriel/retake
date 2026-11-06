import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { serverEnv } from "@/env";
import * as schema from "./schema";

export type Database = NeonHttpDatabase<typeof schema>;

let instance: Database | undefined;

/**
 * Lazily created Drizzle client over Neon's HTTP driver (works in Vercel
 * functions). Created on first use so builds don't need DATABASE_URL.
 *
 * The app runtime prefers DATABASE_URL_POOLED (Neon pooler, set in
 * production); migrations and drizzle-kit keep the direct DATABASE_URL.
 */
export function db(): Database {
  if (!instance) {
    const env = serverEnv();
    instance = drizzle({ client: neon(env.DATABASE_URL_POOLED ?? env.DATABASE_URL), schema });
  }
  return instance;
}
