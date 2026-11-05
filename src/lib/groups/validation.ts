/**
 * Input rules for groups (Zod), shared by Server Actions and client forms
 * (so nothing here may import Node-only modules).
 */
import { z } from "zod";

export const MAX_MEMBERS = 30;

export const groupNameSchema = z
  .string()
  .trim()
  .min(2, "O nome precisa de pelo menos 2 caracteres.")
  .max(40, "Use no máximo 40 caracteres.");

/** Path segments under /groups that can't be a group slug. */
export const RESERVED_SLUGS = new Set(["new", "novo", "join", "invite", "convite", "settings", "ajustes", "create"]);

export const SLUG_MIN = 3;
export const SLUG_MAX = 32;

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(SLUG_MIN, `O endereço precisa de pelo menos ${SLUG_MIN} caracteres.`)
  .max(SLUG_MAX, `Use no máximo ${SLUG_MAX} caracteres.`)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use só letras sem acento, números e hífens entre palavras.")
  .refine((s) => !RESERVED_SLUGS.has(s), "Esse endereço é reservado. Escolha outro.");

/** "Os Parças!" → "os-parcas". May come out shorter than SLUG_MIN; the form shows that. */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export const createGroupSchema = z.object({ name: groupNameSchema, slug: slugSchema });

/* -------------------------------------------------------------- invites -- */

/** Shape of an invite token (see invite.ts). */
export const inviteCodeSchema = z.string().regex(/^[A-Za-z0-9_-]{24}$/);

/* -------------------------------------------------------------- webhook -- */

const WEBHOOK_HOSTS = new Set(["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"]);
const WEBHOOK_PATH = /^\/api(?:\/v\d+)?\/webhooks\/(\d{17,20})\/([A-Za-z0-9_-]{30,100})\/?$/;

/**
 * A Discord webhook URL, normalised to https://discord.com/api/webhooks/{id}/{token}.
 * Anything else (another host, http, a Slack URL…) is rejected, so the sync
 * can never be pointed at an arbitrary server.
 */
export const webhookUrlSchema = z
  .string()
  .trim()
  .min(1, "Cole a URL do webhook.")
  .transform((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      url = new URL("invalid:");
    }
    const match = WEBHOOK_PATH.exec(url.pathname);
    if (url.protocol !== "https:" || !WEBHOOK_HOSTS.has(url.hostname) || !match || url.username || url.password || url.port) {
      ctx.addIssue({
        code: "custom",
        message: "Isso não parece um webhook do Discord. Copie em Editar canal › Integrações › Webhooks › Copiar URL.",
      });
      return z.NEVER;
    }
    return `https://discord.com/api/webhooks/${match[1]}/${match[2]}`;
  });

/** Safe to show: only the last digits of the webhook id, never the token. */
export function maskWebhook(url: string): string {
  const id = WEBHOOK_PATH.exec(new URL(url).pathname)?.[1] ?? "";
  return `discord.com/api/webhooks/…${id.slice(-4)}/••••••`;
}
