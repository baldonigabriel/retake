/** Riot ID is the product identity; the OAuth profile is only a pre-onboarding fallback. */
export function accountDisplayName(providerName: string, riotName?: string | null): string {
  const trimmed = riotName?.trim();
  return trimmed || providerName;
}
