/**
 * Bagre writes (docs/SPEC.md §5.5). Every function re-checks, in the
 * database, who the caller is in the group the row belongs to; nothing
 * trusts a group id, role or membership sent by the client.
 */
import "server-only";

import { eq } from "drizzle-orm";

import type { Database } from "@/db";
import { groups } from "@/db/schema";
import { getRole } from "@/lib/groups/queries";

import { BagreError } from "./errors";
import type { BagreSettingsInput } from "./validation";

/** Owner turns the Bagre on/off and picks the cadence (applies from the next period on). */
export async function updateBagreSettings(database: Database, userId: string, input: BagreSettingsInput): Promise<void> {
  const role = await getRole(input.groupId, userId);
  if (role === null) throw new BagreError("not_found");
  if (role !== "owner") throw new BagreError("forbidden");
  await database
    .update(groups)
    .set({ bagreEnabled: input.enabled, bagreCadence: input.cadence })
    .where(eq(groups.id, input.groupId));
}
