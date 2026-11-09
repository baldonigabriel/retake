import "server-only";

import { headers } from "next/headers";
import { connection } from "next/server";

import { WindowLimiter, clientIp } from "./rate-limit";

/**
 * 20 searches per minute per IP in production (SPEC §6.4): plenty for a
 * person, too slow to walk the user list. Locally every e2e test shares one
 * IP, so dev gets a high ceiling (the limiter itself is unit-tested).
 */
const limiter = new WindowLimiter(process.env.NODE_ENV === "production" ? 20 : 1_000, 60_000);

/** Counts one search for the requesting IP; false once it's over the limit. */
export async function takeSearchQuota(): Promise<boolean> {
  // Request time only: the clock must never be read while prerendering.
  await connection();
  const h = await headers();
  return limiter.take(clientIp((name) => h.get(name)), Date.now());
}
