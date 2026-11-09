/**
 * What deleting an account does to the groups the user owns (pure, no DB).
 * The oldest other member inherits each group (ties by user id, so the
 * choice is stable); a group with nobody else is deleted with the account.
 */
export type OwnedGroup = {
  groupId: string;
  name: string;
  members: readonly { userId: string; name: string; joinedAt: Date }[];
};

export type GroupFate = { groupId: string; name: string; heir: { userId: string; name: string } | null };

export function planOwnedGroups(groups: readonly OwnedGroup[], leavingUserId: string): GroupFate[] {
  return groups.map((group) => {
    const heir = group.members
      .filter((m) => m.userId !== leavingUserId)
      .sort((a, b) => a.joinedAt.getTime() - b.joinedAt.getTime() || a.userId.localeCompare(b.userId))[0];
    return { groupId: group.groupId, name: group.name, heir: heir ? { userId: heir.userId, name: heir.name } : null };
  });
}

/** One sentence per group for the confirmation dialog. */
export function describeGroupFates(fates: readonly GroupFate[]): string[] {
  return fates.map((f) =>
    f.heir ? `${f.name} passa para ${f.heir.name}, o membro mais antigo.` : `${f.name} é apagado, porque não tem outros membros.`,
  );
}
