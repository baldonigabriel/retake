"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { MAX_GOALS, goalInputSchema, goalLabel } from "@/lib/goals/goals";
import { GoalLimitError, deleteGoal, saveGoal } from "@/lib/goals/queries";

/**
 * Goal Server Actions: session → Zod → write scoped to the session's user.
 * Inputs are `unknown`: anything can be posted to an action.
 */
export type GoalActionResult =
  | { ok: true; message: string }
  | { ok: false; message: string; field?: "metric" | "target" };

const UNAVAILABLE = "Algo falhou do nosso lado. Tente de novo em alguns segundos.";

export async function saveGoalAction(input: unknown): Promise<GoalActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre com o Discord de novo." };

  const parsed = goalInputSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      message: issue?.message ?? "Confira a meta e tente de novo.",
      field: issue?.path[0] === "metric" ? "metric" : "target",
    };
  }

  try {
    const result = await saveGoal(user.id, parsed.data);
    revalidatePath("/me");
    const label = goalLabel(parsed.data.metric, parsed.data.target);
    return { ok: true, message: result === "updated" ? `Meta atualizada: ${label}` : `Meta criada: ${label}` };
  } catch (error) {
    if (error instanceof GoalLimitError) {
      return { ok: false, message: `Você já tem ${MAX_GOALS} metas. Remova uma para criar outra.` };
    }
    console.error("[goals] save failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
}

export async function deleteGoalAction(goalId: unknown): Promise<GoalActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre com o Discord de novo." };
  const id = z.uuid().safeParse(goalId);
  if (!id.success) return { ok: false, message: "Essa meta não existe mais." };
  try {
    const removed = await deleteGoal(user.id, id.data);
    revalidatePath("/me");
    return removed ? { ok: true, message: "Meta removida" } : { ok: false, message: "Essa meta não existe mais." };
  } catch (error) {
    console.error("[goals] delete failed", error);
    return { ok: false, message: UNAVAILABLE };
  }
}
