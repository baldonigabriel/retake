import "server-only";

import { headers } from "next/headers";

import { WindowLimiter, clientIp } from "./rate-limit";

/** 20 searches per minute per IP (SPEC §6.4): plenty for a person, too slow to walk the user list. */
const limiter = new WindowLimiter(20, 60_000);

/** Counts one search for the requesting IP; false once it's over the limit. */
export async function takeSearchQuota(): Promise<boolean> {
  const h = await headers();
  return limiter.take(clientIp((name) => h.get(name)), Date.now());
}
