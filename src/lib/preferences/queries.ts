/**
 * User preferences (user_preferences). Always keyed by the session's user id.
 * No row means the defaults.
 */
import "server-only";

import { eq } from "drizzle-orm";

import { db } from "@/db";
import { userPreferences } from "@/db/schema";

/** Whether the "take a break" note is on. Defaults to on; a failed read also falls back to on. */
export async function getBreakReminder(userId: string): Promise<boolean> {
  try {
    const [row] = await db()
      .select({ on: userPreferences.breakReminder })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId))
      .limit(1);
    return row?.on ?? true;
  } catch (error) {
    console.error("[preferences] read failed", error);
    return true;
  }
}

export async function setBreakReminder(userId: string, on: boolean): Promise<void> {
  const now = new Date();
  await db()
    .insert(userPreferences)
    .values({ userId, breakReminder: on, updatedAt: now })
    .onConflictDoUpdate({ target: userPreferences.userId, set: { breakReminder: on, updatedAt: now } });
}
