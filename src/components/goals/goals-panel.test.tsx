import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PlayerMatchLine } from "@/lib/stats/aggregate";

const listGoals = vi.fn();
vi.mock("@/lib/goals/queries", () => ({ listGoals: (...args: unknown[]) => listGoals(...args) }));
vi.mock("@/app/(app)/me/goal-actions", () => ({ saveGoalAction: vi.fn(), deleteGoalAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const { GoalsPanel } = await import("./goals-panel");

const week: PlayerMatchLine[] = Array.from({ length: 4 }, () => ({
  queueId: "competitive",
  roundsPlayed: 20,
  winningTeam: "Blue",
  won: true,
  kills: 20,
  deaths: 10,
  assists: 5,
  score: 5000,
  damageDealt: 3000,
  headshots: 25,
  bodyshots: 70,
  legshots: 5,
}));

async function renderPanel() {
  render(await GoalsPanel({ userId: "u1", weekLines: week, lastWeekLines: [], weekLabel: "2 – 8 de nov" }));
}

describe("GoalsPanel", () => {
  beforeEach(() => {
    listGoals.mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("shows the empty state with one clear action", async () => {
    listGoals.mockResolvedValue([]);
    await renderPanel();
    expect(screen.getByText("Nenhuma meta para esta semana")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Criar meta" })).toBeInTheDocument();
  });

  it("shows progress with text, not colour alone", async () => {
    listGoals.mockResolvedValue([
      { id: "00000000-0000-4000-8000-000000000001", metric: "hs", target: 20 },
      { id: "00000000-0000-4000-8000-000000000002", metric: "acs", target: 300 },
    ]);
    await renderPanel();
    expect(screen.getByText("HS% acima de 20%")).toBeInTheDocument();
    expect(screen.getByText("Batida")).toBeInTheDocument();
    expect(screen.getByText("Abaixo")).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: "Progresso: ACS acima de 300" })).toHaveAttribute("aria-valuenow", "83");
    expect(screen.getByText("Faltam 50 de ACS (4 partidas na semana).")).toBeInTheDocument();
  });

  it("shows a local error state with a retry when the goals can't load", async () => {
    listGoals.mockRejectedValue(new Error("db down"));
    await renderPanel();
    expect(screen.getByRole("alert")).toHaveTextContent("Não conseguimos carregar suas metas");
    expect(screen.getByRole("button", { name: "Tentar de novo" })).toBeInTheDocument();
  });
});
