"use server";

import { db } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { BAGRE_MESSAGES, BagreError, type BagreErrorCode } from "@/lib/bagre/errors";
import { updateBagreSettings } from "@/lib/bagre/mutations";
import { bagreSettingsSchema } from "@/lib/bagre/validation";

/**
 * Bagre Server Actions. Each one: session → Zod input → membership/role check
 * in the database (inside src/lib/bagre/mutations) → write.
 */

type Code = BagreErrorCode | "signed_out" | "invalid" | "unavailable";
export type BagreActionResult<T = object> = ({ ok: true } & T) | { ok: false; code: Code; message: string };

const MESSAGES: Record<Code, string> = {
  ...BAGRE_MESSAGES,
  signed_out: "Sua sessão expirou. Entre com o Discord de novo.",
  invalid: "Confira os campos e tente de novo.",
  unavailable: "Algo falhou do nosso lado. Tente de novo em alguns segundos.",
};

const fail = (code: Code, message?: string) => ({ ok: false, code, message: message ?? MESSAGES[code] }) as const;

function handle(error: unknown, scope: string) {
  if (error instanceof BagreError) return fail(error.code);
  console.error(`[bagre] ${scope} failed`, error);
  return fail("unavailable");
}

export async function saveBagreSettingsAction(input: unknown): Promise<BagreActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const parsed = bagreSettingsSchema.safeParse(input);
  if (!parsed.success) return fail("not_found");
  try {
    await updateBagreSettings(db(), user.id, parsed.data);
    return { ok: true };
  } catch (error) {
    return handle(error, "settings");
  }
}
