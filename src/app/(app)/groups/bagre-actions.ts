"use server";

import { db } from "@/db";
import { getSessionUser } from "@/lib/auth/session";
import { BAGRE_MESSAGES, BagreError, type BagreErrorCode } from "@/lib/bagre/errors";
import { castVote, nominate, updateBagreSettings, withdrawNomination } from "@/lib/bagre/mutations";
import { bagreSettingsSchema, nominateSchema, nominationIdSchema } from "@/lib/bagre/validation";

/**
 * Bagre Server Actions. Each one: session → Zod input → membership/role check
 * in the database (inside src/lib/bagre/mutations) → write.
 */

type Code = BagreErrorCode | "signed_out" | "invalid" | "unavailable";
export type BagreActionResult<T = object> =
  | ({ ok: true } & T)
  | { ok: false; code: Code; message: string; field?: "comment" };

const MESSAGES: Record<Code, string> = {
  ...BAGRE_MESSAGES,
  signed_out: "Sua sessão expirou. Entre com o Discord de novo.",
  invalid: "Confira os campos e tente de novo.",
  unavailable: "Algo falhou do nosso lado. Tente de novo em alguns segundos.",
};

const fail = (code: Code, message?: string, field?: "comment") =>
  ({ ok: false, code, message: message ?? MESSAGES[code], field }) as const;

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

/** Nominates another member of the round's group, tied to one of their matches in the period. */
export async function nominateAction(input: unknown): Promise<BagreActionResult<{ nominationId: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const parsed = nominateSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return issue?.path[0] === "comment" ? fail("invalid", issue.message, "comment") : fail("not_found");
  }
  try {
    return { ok: true, nominationId: await nominate(db(), user.id, parsed.data) };
  } catch (error) {
    return handle(error, "nominate");
  }
}

export async function withdrawNominationAction(nominationId: unknown): Promise<BagreActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const id = nominationIdSchema.safeParse(nominationId);
  if (!id.success) return fail("not_found");
  try {
    await withdrawNomination(db(), user.id, id.data);
    return { ok: true };
  } catch (error) {
    return handle(error, "withdraw");
  }
}

/** Casts the caller's vote, or moves it to another nomination. */
export async function voteAction(nominationId: unknown): Promise<BagreActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const id = nominationIdSchema.safeParse(nominationId);
  if (!id.success) return fail("not_found");
  try {
    await castVote(db(), user.id, id.data);
    return { ok: true };
  } catch (error) {
    return handle(error, "vote");
  }
}
