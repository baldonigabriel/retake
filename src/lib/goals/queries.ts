/**
 * Goal reads and writes. Every call is scoped to the user id the caller got
 * from the session: a goal id from the client is only ever matched together
 * with that user id, so nobody can touch someone else's goal.
 */
import "server-only";

import { and, asc, count, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { goals } from "@/db/schema";

import { GOAL_METRICS, MAX_GOALS, type GoalInput, type GoalMetric } from "./goals";

export type StoredGoal = { id: string; metric: GoalMetric; target: number };

const ORDER = sql`array_position(array[${sql.join(
  GOAL_METRICS.map((m) => sql`${m}`),
  sql`, `,
)}]::goal_metric[], ${goals.metric})`;

/** The user's goals, in the metric order of the form. */
export async function listGoals(userId: string): Promise<StoredGoal[]> {
  return db()
    .select({ id: goals.id, metric: goals.metric, target: goals.target })
    .from(goals)
    .where(eq(goals.userId, userId))
    .orderBy(ORDER, asc(goals.createdAt));
}

export class GoalLimitError extends Error {
  constructor() {
    super("goal limit reached");
    this.name = "GoalLimitError";
  }
}

/**
 * Creates the goal, or updates the target when the user already has one for
 * that metric (one goal per metric). New metrics stop at MAX_GOALS.
 */
export async function saveGoal(userId: string, input: GoalInput): Promise<"created" | "updated"> {
  const database = db();
  const [existing] = await database
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.userId, userId), eq(goals.metric, input.metric)))
    .limit(1);
  if (existing) {
    await database.update(goals).set({ target: input.target, updatedAt: new Date() }).where(eq(goals.id, existing.id));
    return "updated";
  }
  const [{ total } = { total: 0 }] = await database.select({ total: count() }).from(goals).where(eq(goals.userId, userId));
  if (total >= MAX_GOALS) throw new GoalLimitError();
  // A double submit races to the unique (user, metric) index: the second becomes an update.
  await database
    .insert(goals)
    .values({ userId, metric: input.metric, target: input.target })
    .onConflictDoUpdate({ target: [goals.userId, goals.metric], set: { target: input.target, updatedAt: new Date() } });
  return "created";
}

/** True when a goal of this user was removed. */
export async function deleteGoal(userId: string, goalId: string): Promise<boolean> {
  const removed = await db()
    .delete(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning({ id: goals.id });
  return removed.length > 0;
}
