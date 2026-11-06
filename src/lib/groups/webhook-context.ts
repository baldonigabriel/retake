/**
 * Additional authenticated data for a group's encrypted webhook: a ciphertext
 * copied to another group won't decrypt. Kept apart from mutations.ts (which
 * is server-only) so the framework-free Discord delivery can use it too.
 */
export function webhookContext(groupId: string): string {
  return `group-webhook:${groupId}`;
}
