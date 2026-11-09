/**
 * The weapons sold in the buy menu (valorant-api.com/v1/weapons, melee left
 * out). Kills with abilities and ultimates ("Not Dead Yet", Showstopper,
 * Blade Storm...) and the knife never show up in the weapon stats.
 *
 * Matched by uuid first; by the English name as a fallback for rows saved
 * without an id. A weapon added to the game later shows up once it's listed
 * here (a missing entry hides it, it never mislabels one).
 */
export const SHOP_WEAPONS = [
  { id: "29a0cfab-485b-f5d5-779a-b59f85e204a8", name: "Classic", category: "sidearm" },
  { id: "42da8ccc-40d5-affc-beec-15aa47b42eda", name: "Shorty", category: "sidearm" },
  { id: "44d4e95c-4157-0037-81b2-17841bf2e8e3", name: "Frenzy", category: "sidearm" },
  { id: "1baa85b4-4c70-1284-64bb-6481dfc3bb4e", name: "Ghost", category: "sidearm" },
  { id: "410b2e0b-4ceb-1321-1727-20858f7f3477", name: "Bandit", category: "sidearm" },
  { id: "e336c6b8-418d-9340-d77f-7a9e4cfe0702", name: "Sheriff", category: "sidearm" },
  { id: "f7e1b454-4ad4-1063-ec0a-159e56b58941", name: "Stinger", category: "smg" },
  { id: "462080d1-4035-2937-7c09-27aa2a5c27a7", name: "Spectre", category: "smg" },
  { id: "910be174-449b-c412-ab22-d0873436b21b", name: "Bucky", category: "shotgun" },
  { id: "ec845bf4-4f79-ddda-a3da-0db3774b2794", name: "Judge", category: "shotgun" },
  { id: "ae3de142-4d85-2547-dd26-4e90bed35cf7", name: "Bulldog", category: "rifle" },
  { id: "4ade7faa-4cf1-8376-95ef-39884480959b", name: "Guardian", category: "rifle" },
  { id: "ee8e8d15-496b-07ac-e5f6-8fae5d4c7b1a", name: "Phantom", category: "rifle" },
  { id: "9c82e19d-4575-0200-1a81-3eacf00cf872", name: "Vandal", category: "rifle" },
  { id: "8db0a1bf-4a50-832a-4566-faaaa6d250ca", name: "Warden", category: "rifle" },
  { id: "c4883e50-4494-202c-3ec3-6b8a9284f00b", name: "Marshal", category: "sniper" },
  { id: "5f0aaf7a-4289-3998-d5ff-eb9a5cf7ef5c", name: "Outlaw", category: "sniper" },
  { id: "a03b24d3-4319-996d-0f8c-94bbfba1dfc7", name: "Operator", category: "sniper" },
  { id: "55d8a0f4-4274-ca67-fe2c-06ab45efdf58", name: "Ares", category: "heavy" },
  { id: "63e6c2b6-4a8e-869c-3d4c-e38355226584", name: "Odin", category: "heavy" },
] as const;

export type ShopWeapon = (typeof SHOP_WEAPONS)[number];

const BY_ID = new Map<string, ShopWeapon>(SHOP_WEAPONS.map((w) => [w.id, w]));
const BY_NAME = new Map<string, ShopWeapon>(SHOP_WEAPONS.map((w) => [w.name.toLowerCase(), w]));

/** The shop weapon for an id/name pair from the API, or null (ability, ultimate, knife, unknown). */
export function shopWeapon(id: string | null | undefined, name: string | null | undefined): ShopWeapon | null {
  return (id ? BY_ID.get(id.toLowerCase()) : undefined) ?? (name ? BY_NAME.get(name.trim().toLowerCase()) : undefined) ?? null;
}
