/**
 * Input rules for the Bagre (Zod), shared by Server Actions and client forms
 * (so nothing here may import Node-only modules). Inputs are `unknown` on the
 * server: anything can be posted to an action, not only what our forms send.
 */
import { z } from "zod";

import { CADENCES } from "./period";

export const groupIdSchema = z.uuid();

export const bagreSettingsSchema = z.object({
  groupId: groupIdSchema,
  enabled: z.boolean(),
  cadence: z.enum(CADENCES),
});
export type BagreSettingsInput = z.infer<typeof bagreSettingsSchema>;

export const COMMENT_MAX = 140;

/** One line: newlines and runs of spaces collapse to one space before counting. */
export const commentSchema = z
  .string()
  .transform((s) => s.replace(/\s+/g, " ").trim())
  .pipe(
    z
      .string()
      .min(1, "Escreva o motivo em poucas palavras.")
      .max(COMMENT_MAX, `Use no máximo ${COMMENT_MAX} caracteres.`),
  );

const userIdSchema = z.string().min(1).max(200);
const matchIdSchema = z.string().min(1).max(100);

export const nominateSchema = z.object({
  roundId: z.uuid(),
  nomineeId: userIdSchema,
  matchId: matchIdSchema,
  comment: commentSchema,
});
export type NominateInput = z.infer<typeof nominateSchema>;

export const nominationIdSchema = z.uuid();
