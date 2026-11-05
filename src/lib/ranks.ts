/** Competitive tiers (0 = unranked, 3–26 = Iron 1 → Immortal 3, 27 = Radiant). */

const DIVISIONS = ["Ferro", "Bronze", "Prata", "Ouro", "Platina", "Diamante", "Ascendente", "Imortal"] as const;

/** pt-BR tier name ("Diamante 1"); falls back to the API name for unknown ids. */
export function tierLabel(tier: number | null | undefined, apiName?: string | null): string {
  if (tier == null || tier <= 2) return "Sem rank";
  if (tier === 27) return "Radiante";
  const division = DIVISIONS[Math.floor((tier - 3) / 3)];
  if (!division) return apiName ?? `Tier ${tier}`;
  return `${division} ${((tier - 3) % 3) + 1}`;
}

/** Current competitive tier set on media.valorant-api.com (community assets). */
const TIER_SET = "03621f52-342b-cf4e-4f86-9350a49c6d04";

export function tierIconUrl(tier: number | null | undefined): string | undefined {
  if (tier == null || tier < 3 || tier > 27 || !Number.isInteger(tier)) return undefined;
  return `https://media.valorant-api.com/competitivetiers/${TIER_SET}/${tier}/smallicon.png`;
}
