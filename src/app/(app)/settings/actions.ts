"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth/session";
import { setBreakReminder } from "@/lib/preferences/queries";

export type PreferenceActionResult = { ok: true; on: boolean } | { ok: false; message: string };

/** Turns the "take a break" note on or off for the session's user. */
export async function setBreakReminderAction(input: unknown): Promise<PreferenceActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre com o Discord de novo." };
  const parsed = z.boolean().safeParse(input);
  if (!parsed.success) return { ok: false, message: "Não entendemos o pedido. Tente de novo." };
  try {
    await setBreakReminder(user.id, parsed.data);
  } catch (error) {
    console.error("[preferences] save failed", error);
    return { ok: false, message: "Algo falhou do nosso lado. Tente de novo em alguns segundos." };
  }
  revalidatePath("/settings");
  revalidatePath("/me");
  return { ok: true, on: parsed.data };
}
