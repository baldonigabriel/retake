"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";

import { db } from "@/db";
import { deleteAccount } from "@/lib/account/delete";
import { unlinkLoginAccount } from "@/lib/auth/accounts";
import { getSessionUser } from "@/lib/auth/session";
import { setBreakReminder } from "@/lib/preferences/queries";
import { PROFILE_LATER_COOKIE, PROFILE_LATER_DAYS } from "@/lib/profile/later";
import { getProfileSettings, saveProfileChoice } from "@/lib/profile/queries";
import { isProfileVisible, profileChoiceSchema } from "@/lib/profile/settings";

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

export type ProfileActionResult = { ok: true; visible: boolean } | { ok: false; message: string };

/**
 * Saves the public/private answer (onboarding, the /me card, Ajustes). It
 * takes effect at once: /u/... and the search read it on every request.
 */
export async function saveProfileAction(input: unknown): Promise<ProfileActionResult> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre de novo para continuar." };
  const parsed = profileChoiceSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Não entendemos o pedido. Atualize a página e tente de novo." };
  try {
    const saved = await saveProfileChoice(user.id, parsed.data);
    revalidatePath("/settings");
    revalidatePath("/me");
    return { ok: true, visible: isProfileVisible(saved) };
  } catch (error) {
    console.error("[profile] save failed", error);
    return { ok: false, message: "Algo falhou do nosso lado. Tente de novo em alguns segundos." };
  }
}

/** "Agora não" on the /me card: hides the question for a while; the profile stays private. */
export async function postponeProfileQuestionAction(): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre de novo para continuar." };
  const settings = await getProfileSettings(user.id);
  if (!settings.decidedAt) {
    (await cookies()).set(PROFILE_LATER_COOKIE, user.id, {
      maxAge: PROFILE_LATER_DAYS * 86_400,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  revalidatePath("/me");
  return { ok: true };
}

/**
 * Deletes the session's own account (src/lib/account/delete.ts) and clears
 * the auth cookies. The client then leaves for the landing page.
 */
export async function deleteAccountAction(): Promise<{ ok: true } | { ok: false; message: string }> {
  const user = await getSessionUser();
  if (!user) return { ok: false, message: "Sua sessão expirou. Entre de novo para continuar." };
  try {
    await deleteAccount(user.id);
  } catch (error) {
    console.error("[account] delete failed", error);
    return { ok: false, message: "Não foi possível apagar a conta agora. Nada foi apagado; tente de novo em alguns segundos." };
  }
  const jar = await cookies();
  for (const cookie of jar.getAll()) {
    if (cookie.name.includes("better-auth.")) jar.delete(cookie.name);
  }
  return { ok: true };
}
