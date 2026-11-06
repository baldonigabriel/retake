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
