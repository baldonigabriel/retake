import { describe, expect, it } from "vitest";

import { describeGroupFates, planOwnedGroups } from "./delete-plan";

const at = (day: number) => new Date(Date.UTC(2026, 10, day));

describe("account deletion: owned groups", () => {
  it("hands each group to the oldest other member", () => {
    const [fate] = planOwnedGroups(
      [
        {
          groupId: "g1",
          name: "Os Parças",
          members: [
            { userId: "me", name: "Eu", joinedAt: at(1) },
            { userId: "b", name: "Bia", joinedAt: at(5) },
            { userId: "a", name: "Ana", joinedAt: at(3) },
          ],
        },
      ],
      "me",
    );
    expect(fate).toEqual({ groupId: "g1", name: "Os Parças", heir: { userId: "a", name: "Ana" } });
  });

  it("breaks ties by user id so the heir is stable", () => {
    const [fate] = planOwnedGroups(
      [
        {
          groupId: "g1",
          name: "G",
          members: [
            { userId: "z", name: "Zé", joinedAt: at(2) },
            { userId: "m", name: "Mia", joinedAt: at(2) },
          ],
        },
      ],
      "me",
    );
    expect(fate?.heir?.userId).toBe("m");
  });

  it("deletes a group where the owner is alone", () => {
    const fates = planOwnedGroups([{ groupId: "g2", name: "Solo", members: [{ userId: "me", name: "Eu", joinedAt: at(1) }] }], "me");
    expect(fates).toEqual([{ groupId: "g2", name: "Solo", heir: null }]);
    expect(describeGroupFates(fates)).toEqual(["Solo é apagado, porque não tem outros membros."]);
  });

  it("explains each transfer in plain words", () => {
    expect(describeGroupFates([{ groupId: "g", name: "Os Parças", heir: { userId: "a", name: "Ana" } }])).toEqual([
      "Os Parças passa para Ana, o membro mais antigo.",
    ]);
  });
});
