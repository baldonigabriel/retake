import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DeltaChip } from "./delta-chip";
import { ResultChip } from "./result-chip";

describe("ResultChip", () => {
  it.each([
    ["win", "V", "Vitória"],
    ["loss", "D", "Derrota"],
    ["draw", "E", "Empate"],
  ] as const)("never relies on colour alone (%s)", (result, letter, label) => {
    const { container } = render(<ResultChip result={result} />);
    expect(container).toHaveTextContent(letter);
    expect(screen.getByText(label)).toHaveClass("sr-only");
  });

  it("can show the full word", () => {
    render(<ResultChip result="loss" long />);
    expect(screen.getByText("Derrota")).toBeVisible();
  });
});

describe("DeltaChip", () => {
  it("pairs colour with an arrow and a word", () => {
    const { container } = render(<DeltaChip value={2.1} suffix="vs. sua média" />);
    expect(container).toHaveTextContent("▲");
    expect(container).toHaveTextContent("subiu");
    expect(container).toHaveTextContent("+2,1");
  });

  it("flips colour when lower is better", () => {
    const { container } = render(<DeltaChip value={-3} lowerIsBetter />);
    expect(container.firstElementChild).toHaveClass("text-win");
  });
});
