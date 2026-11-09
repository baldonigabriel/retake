import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { PlayerRoundMetrics } from "@/lib/rounds";

import { RoundsPanel } from "./rounds-panel";
import { WeaponsPanel } from "./weapons-panel";

const emptyClutch = {
  1: { situations: 0, wins: 0, rate: null },
  2: { situations: 0, wins: 0, rate: null },
  3: { situations: 0, wins: 0, rate: null },
  4: { situations: 0, wins: 0, rate: null },
  5: { situations: 0, wins: 0, rate: null },
} as const;

const metrics: PlayerRoundMetrics = {
  rounds: 20,
  firstBlood: { value: 0.15, successes: 3, sample: 20 },
  firstDeath: { value: 0.1, successes: 2, sample: 20 },
  multiKills: { three: 1, four: 0, ace: 0 },
  clutch: { ...emptyClutch, 2: { situations: 2, wins: 1, rate: 0.5 } },
  kast: { value: 0.7, successes: 14, sample: 20 },
  economy: [],
  sides: [],
  weapons: [],
};

describe("round breakdown UI", () => {
  it("shows rates with an explicit round sample", () => {
    render(<RoundsPanel metrics={metrics} />);
    expect(screen.getByText("3 · 15,0%")).toBeInTheDocument();
    expect(screen.getAllByText("amostra: 20 rounds").length).toBeGreaterThan(0);
    expect(screen.getByText("1v2:")).toBeInTheDocument();
  });

  it("labels weapon HS as approximate and flags a small sample", () => {
    render(
      <WeaponsPanel
        weapons={[
          {
            weaponId: "vandal",
            weaponName: "Vandal",
            kills: 4,
            headshots: 8,
            shots: 40,
            hsRate: 0.2,
            shotSampleRounds: 3,
            matches: 2,
            prominent: false,
          },
        ]}
      />,
    );
    expect(screen.getByText(/HS% aproximado/)).toBeInTheDocument();
    expect(screen.getAllByText(/amostra pequena/i).length).toBeGreaterThan(0);
  });
});
