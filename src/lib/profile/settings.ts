/**
 * Public profile preferences (SPEC §6): which sections a visitor sees and
 * the one rule that decides whether a profile exists for the outside world.
 * Pure: no database, safe to import from client components.
 */
import { z } from "zod";

/** Sections a public profile can show, in page order. */
export const PROFILE_FIELDS = [
  { key: "showRank", label: "Rank e RR", description: "Rank atual, RR e a evolução do rank." },
  { key: "showOverview", label: "Visão geral", description: "ACS, K/D, HS%, ADR, vitórias e a tendência." },
  { key: "showAgents", label: "Agentes", description: "Partidas, vitórias e números por agente." },
  { key: "showMaps", label: "Mapas", description: "Vitórias e números por mapa." },
  { key: "showWeapons", label: "Armas", description: "Abates e HS% aproximado por arma." },
  { key: "showMatches", label: "Últimas partidas", description: "Só a sua linha em cada partida, sem os outros jogadores." },
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number]["key"];
export type ProfileFields = Record<ProfileField, boolean>;

/** Stored preferences (profile_settings). */
export type ProfileSettings = ProfileFields & {
  isPublic: boolean;
  /** When the user answered the public/private question; null = never asked. */
  decidedAt: Date | null;
};

export const ALL_FIELDS_ON: ProfileFields = {
  showRank: true,
  showOverview: true,
  showAgents: true,
  showMaps: true,
  showWeapons: true,
  showMatches: true,
};

/** No row in profile_settings: private and never asked. */
export const DEFAULT_PROFILE_SETTINGS: ProfileSettings = {
  ...ALL_FIELDS_ON,
  isPublic: false,
  decidedAt: null,
};

export function visibleFields(fields: ProfileFields): ProfileField[] {
  return PROFILE_FIELDS.filter((f) => fields[f.key]).map((f) => f.key);
}

/**
 * The single access rule: a profile is visible to the outside world only
 * when its owner chose "public" AND left at least one section on (SPEC §6.2:
 * unchecking everything is the same as private). Anything else answers
 * exactly like a profile that doesn't exist.
 */
export function isProfileVisible(settings: Pick<ProfileSettings, "isPublic"> & ProfileFields): boolean {
  return settings.isPublic && visibleFields(settings).length > 0;
}

/** What the onboarding step, the /me card and Ajustes send. */
export const profileChoiceSchema = z.object({
  visibility: z.enum(["public", "private"]),
  fields: z
    .object({
      showRank: z.boolean(),
      showOverview: z.boolean(),
      showAgents: z.boolean(),
      showMaps: z.boolean(),
      showWeapons: z.boolean(),
      showMatches: z.boolean(),
    })
    .strict(),
});
export type ProfileChoice = z.infer<typeof profileChoiceSchema>;

/**
 * The row to store for a choice. "Public" with every section off is saved as
 * private (the screen says so before saving); the section choices are kept
 * either way so switching back to public restores them.
 */
export function settingsFromChoice(choice: ProfileChoice): ProfileFields & { isPublic: boolean } {
  const isPublic = choice.visibility === "public" && visibleFields(choice.fields).length > 0;
  return { ...choice.fields, isPublic };
}

/** The choice to pre-fill the controls with; null when the user never answered (nothing pre-selected). */
export function choiceFromSettings(settings: ProfileSettings): ProfileChoice | null {
  if (!settings.decidedAt) return null;
  const fields: ProfileFields = {
    showRank: settings.showRank,
    showOverview: settings.showOverview,
    showAgents: settings.showAgents,
    showMaps: settings.showMaps,
    showWeapons: settings.showWeapons,
    showMatches: settings.showMatches,
  };
  return { visibility: settings.isPublic ? "public" : "private", fields };
}
