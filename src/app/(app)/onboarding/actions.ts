"use server";

import { z } from "zod";

import { db } from "@/db";
import {
  IMPORT_PAGE_SIZE,
  canImportPage,
  isLastPage,
} from "@/lib/accounts/initial-import";
import { LinkError, linkRiotAccount, previewRiotAccount, toLinkError, type LinkErrorCode, type RiotAccountPreview } from "@/lib/accounts/link";
import { getLinkedAccount, getSessionUser } from "@/lib/auth/session";
import { henrikClient } from "@/lib/henrik";
import { parseRiotId } from "@/lib/riot-id";
import { syncAccount } from "@/lib/sync";

export type ActionError = { ok: false; code: LinkErrorCode | "invalid" | "signed_out" | "import_closed"; message: string };

const MESSAGES: Record<ActionError["code"], string> = {
  invalid: "Use o formato Nome#TAG, como aparece no seu perfil do Valorant.",
  not_found: "Não achamos esse Riot ID. Confira o nome e a tag (maiúsculas não importam).",
  claimed: "Esse Riot ID já está vinculado a outra pessoa no Retake. Cada um vincula só a própria conta.",
  already_linked: "Sua conta do Retake já tem outro Riot ID vinculado. Cada conta vincula um Riot ID só.",
  rate_limited: "Muitas buscas ao mesmo tempo. Espere um minuto e tente de novo.",
  unavailable: "O serviço de dados do Valorant não respondeu. Tente de novo em alguns segundos.",
  signed_out: "Sua sessão expirou. Entre com o Discord de novo.",
  import_closed: "A importação inicial já terminou. Use “Sincronizar agora” no painel.",
};

const fail = (code: ActionError["code"]): ActionError => ({ ok: false, code, message: MESSAGES[code] });

const riotIdInput = z
  .object({ gameName: z.string().trim().min(1).max(32), tagLine: z.string().trim().min(1).max(8) })
  .transform((v, ctx) => {
    const parsed = parseRiotId(`${v.gameName}#${v.tagLine}`);
    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "invalid" });
      return z.NEVER;
    }
    return parsed;
  });

const deps = () => ({ db: db(), henrik: henrikClient() });

/** Step 1: look the Riot ID up and return a preview card. Nothing is saved. */
export async function previewAccountAction(
  input: unknown,
): Promise<{ ok: true; preview: RiotAccountPreview } | ActionError> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const parsed = riotIdInput.safeParse(input);
  if (!parsed.success) return fail("invalid");
  try {
    return { ok: true, preview: await previewRiotAccount(deps(), user.id, parsed.data) };
  } catch (error) {
    return fail(toLinkError(error).code);
  }
}

/** Step 2: the user confirmed it's their account → link the puuid to them. */
export async function linkAccountAction(input: unknown): Promise<{ ok: true } | ActionError> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const parsed = riotIdInput.safeParse(input);
  if (!parsed.success) return fail("invalid");
  try {
    await linkRiotAccount(deps(), user.id, parsed.data);
    return { ok: true };
  } catch (error) {
    if (error instanceof LinkError) return fail(error.code);
    console.error("[onboarding] link failed", error);
    return fail("unavailable");
  }
}

export type ImportPageResult =
  | { ok: true; page: number; fetched: number; inserted: number; done: boolean }
  | ActionError;

/** Step 3: import one page of recent history (called in a loop for progress). */
export async function importPageAction(page: unknown): Promise<ImportPageResult> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const account = await getLinkedAccount(user.id);
  const pageNumber = z.number().int().safeParse(page);
  if (!account || !pageNumber.success) return fail("invalid");
  if (!canImportPage(account, pageNumber.data, new Date())) return fail("import_closed");

  const result = await syncAccount(deps(), account, {
    start: pageNumber.data * IMPORT_PAGE_SIZE,
    size: IMPORT_PAGE_SIZE,
  });
  if (result.status === "error") {
    console.error("[onboarding] import page failed", pageNumber.data, result.error);
    return fail(/\b429\b/.test(result.error ?? "") ? "rate_limited" : "unavailable");
  }
  return {
    ok: true,
    page: pageNumber.data,
    fetched: result.fetched,
    // Matches a friend already stored also count as imported for this user.
    inserted: result.inserted.length + result.alreadyStored,
    done: isLastPage(pageNumber.data, result.fetched),
  };
}
