import { describe, expect, it } from "vitest";

import { formatDuration, formatHours, formatNumber, formatPercent, formatRelativeTime, formatSigned } from "./format";

describe("format", () => {
  it("uses pt-BR decimals", () => {
    expect(formatNumber(1.2345, 2)).toBe("1,23");
    expect(formatNumber(1234)).toBe("1.234");
    expect(formatPercent(0.238)).toBe("23,8%");
  });

  it("signs deltas with a true minus and no sign for zero", () => {
    expect(formatSigned(2.1)).toBe("+2,1");
    expect(formatSigned(-0.4)).toBe("−0,4");
    expect(formatSigned(0)).toBe("0,0");
    expect(formatSigned(-0.01)).toBe("0,0");
  });

  it("formats relative time from an injected now", () => {
    const now = new Date("2026-11-05T21:00:00Z");
    const ago = (ms: number) => new Date(now.getTime() - ms);
    expect(formatRelativeTime(ago(10_000), now)).toBe("agora");
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe("há 5 min");
    expect(formatRelativeTime(ago(2 * 3_600_000), now)).toBe("há 2 h");
    expect(formatRelativeTime(ago(3 * 86_400_000), now)).toBe("há 3 d");
  });

  it("formats match duration", () => {
    expect(formatDuration(2_154_000)).toBe("35:54");
    expect(formatDuration(61_000)).toBe("1:01");
  });
});

describe("formatMatchDate", () => {
  it("uses São Paulo time", async () => {
    const { formatMatchDate } = await import("./format");
    const text = formatMatchDate(new Date("2026-11-06T00:03:00Z"));
    expect(text).toContain("21:03");
    expect(text).toMatch(/5 de nov/);
  });
});

describe("formatHours", () => {
  it("uses minutes under an hour and one decimal above", () => {
    expect(formatHours(0)).toBe("0 min");
    expect(formatHours(20_000)).toBe("1 min");
    expect(formatHours(2_700_000)).toBe("45 min");
    expect(formatHours(5_400_000)).toBe("1,5 h");
    expect(formatHours(Number.NaN)).toBe("0 min");
  });
});
