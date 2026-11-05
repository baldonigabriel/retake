import { describe, expect, it } from "vitest";

import { modeAdjective, modeLabel } from "./modes";

describe("modes", () => {
  it("labels known queues in pt-BR and falls back to the API label", () => {
    expect(modeLabel("competitive")).toBe("Competitivo");
    expect(modeLabel("newqueue", "New Queue")).toBe("New Queue");
  });

  it("reads naturally in sentences", () => {
    expect(`Nenhuma partida ${modeAdjective("competitive")}`).toBe("Nenhuma partida competitiva");
    expect(`Nenhuma partida ${modeAdjective("unrated")}`).toBe("Nenhuma partida sem classificação");
    expect(`Nenhuma partida ${modeAdjective("deathmatch")}`).toBe("Nenhuma partida de mata-mata");
  });
});
