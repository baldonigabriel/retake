"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { db } from "@/db";
import { getLinkedAccount, getSessionUser } from "@/lib/auth/session";
import {
  GroupError,
  createGroup,
  joinGroup,
  leaveGroup,
  removeMember,
  revokeInvite,
  setWebhook,
  type GroupErrorCode,
} from "@/lib/groups/mutations";
import { MAX_MEMBERS, createGroupSchema, inviteCodeSchema, webhookUrlSchema } from "@/lib/groups/validation";

/**
 * Group Server Actions. Each one: session → Zod input → role check in the
 * database (inside src/lib/groups/mutations) → write. Inputs are `unknown`
 * because anything can be posted to an action, not only what our forms send.
 */

type Code = GroupErrorCode | "signed_out" | "no_account" | "invalid" | "unavailable";
export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; code: Code; message: string; field?: "name" | "slug" | "url" };

const MESSAGES: Record<Code, string> = {
  signed_out: "Sua sessão expirou. Entre com o Discord de novo.",
  no_account: "Vincule seu Riot ID antes: o ranking do grupo usa as suas partidas.",
  invalid: "Confira os campos e tente de novo.",
  slug_taken: "Esse endereço já está em uso. Tente outro, como o nome com um número no fim.",
  invalid_invite: "Esse convite não vale mais. Peça um link novo para quem criou o grupo.",
  full: `O grupo já tem ${MAX_MEMBERS} membros, o máximo por grupo.`,
  not_found: "Você não faz mais parte desse grupo.",
  forbidden: "Só quem criou o grupo pode fazer isso.",
  self: "Para sair do grupo, use “Sair do grupo”.",
  unavailable: "Algo falhou do nosso lado. Tente de novo em alguns segundos.",
};

const fail = (code: Code, extra: { message?: string; field?: "name" | "slug" | "url" } = {}) =>
  ({ ok: false, code, message: extra.message ?? MESSAGES[code], field: extra.field }) as const;

function handle(error: unknown, scope: string) {
  if (error instanceof GroupError) return fail(error.code);
  console.error(`[groups] ${scope} failed`, error);
  return fail("unavailable");
}

const groupIdSchema = z.uuid();

export async function createGroupAction(input: unknown): Promise<ActionResult<{ slug: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  if (!(await getLinkedAccount(user.id))) return fail("no_account");

  const parsed = createGroupSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0] === "name" ? "name" : "slug";
    return fail("invalid", { message: issue?.message, field });
  }
  try {
    return { ok: true, slug: await createGroup(db(), user.id, parsed.data) };
  } catch (error) {
    const result = handle(error, "create");
    return result.code === "slug_taken" ? { ...result, field: "slug" } : result;
  }
}

export async function joinGroupAction(code: unknown): Promise<ActionResult<{ slug: string }>> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  if (!(await getLinkedAccount(user.id))) return fail("no_account");
  const parsed = inviteCodeSchema.safeParse(code);
  if (!parsed.success) return fail("invalid_invite");
  try {
    return { ok: true, slug: await joinGroup(db(), user.id, parsed.data) };
  } catch (error) {
    return handle(error, "join");
  }
}

export type JoinFormState = { message: string } | null;

/**
 * Invite page form (useActionState). Works before hydration too: a plain form
 * post joins and redirects to the group; errors come back as state.
 */
export async function joinInviteFormAction(_prev: JoinFormState, formData: FormData): Promise<JoinFormState> {
  const result = await joinGroupAction(formData.get("code"));
  if (!result.ok) return { message: result.message };
  redirect(`/groups/${result.slug}`);
}

/** Leaves and goes back to the group list. */
export async function leaveGroupAction(groupId: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const id = groupIdSchema.safeParse(groupId);
  if (!id.success) return fail("not_found");
  try {
    await leaveGroup(db(), user.id, id.data);
  } catch (error) {
    return handle(error, "leave");
  }
  redirect("/groups");
}

export async function removeMemberAction(groupId: unknown, userId: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const ids = z.tuple([groupIdSchema, z.string().min(1).max(100)]).safeParse([groupId, userId]);
  if (!ids.success) return fail("invalid");
  try {
    await removeMember(db(), user.id, ids.data[0], ids.data[1]);
    return { ok: true };
  } catch (error) {
    return handle(error, "remove member");
  }
}

export async function revokeInviteAction(groupId: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const id = groupIdSchema.safeParse(groupId);
  if (!id.success) return fail("not_found");
  try {
    await revokeInvite(db(), user.id, id.data);
    return { ok: true };
  } catch (error) {
    return handle(error, "revoke invite");
  }
}

/** Saves the webhook (encrypted) or, with url = null, removes it. */
export async function saveWebhookAction(groupId: unknown, url: unknown): Promise<ActionResult> {
  const user = await getSessionUser();
  if (!user) return fail("signed_out");
  const id = groupIdSchema.safeParse(groupId);
  if (!id.success) return fail("not_found");

  let value: string | null = null;
  if (url !== null) {
    const parsed = webhookUrlSchema.safeParse(url);
    if (!parsed.success) return fail("invalid", { message: parsed.error.issues[0]?.message, field: "url" });
    value = parsed.data;
  }
  try {
    await setWebhook(db(), user.id, id.data, value);
    return { ok: true };
  } catch (error) {
    return handle(error, "save webhook");
  }
}
