"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { db } from "@/db";
import { unlinkLoginAccount } from "@/lib/auth/accounts";
import { getSessionUser } from "@/lib/auth/session";
import { setBreakReminder } from "@/lib/preferences/queries";

export type PreferenceActionResult = { ok: true; on: boolean } | { ok: false; message: string };
export type UnlinkAccountActionResult = { ok: true } | { ok: false; message: string };

/** Turns the "take a break" note on or off for the session's user. */
export async function setBreakReminderAction(input: unknown): Promise<PreferenceActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre de novo para continuar." };
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

/** Unlinks one OAuth provider while the database guarantees one login remains. */
export async function unlinkLoginAccountAction(input: unknown): Promise<UnlinkAccountActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre de novo para continuar." };
  const parsed = z.string().min(1).max(200).safeParse(input);
  if (!parsed.success) return { ok: false, message: "Não entendemos qual conta desvincular. Atualize a página e tente de novo." };

  try {
    const result = await unlinkLoginAccount(db(), user.id, parsed.data);
    if (!result.ok) {
      return {
        ok: false,
        message:
          result.reason === "last-account"
            ? "Vincule Google ou Discord antes de remover seu único acesso."
            : "Essa conta já não está vinculada. Atualize a página.",
      };
    }
  } catch (error) {
    console.error("[auth] unlink failed", error);
    return { ok: false, message: "Não foi possível desvincular agora. Tente de novo em alguns segundos." };
  }

  revalidatePath("/settings");
  return { ok: true };
}
