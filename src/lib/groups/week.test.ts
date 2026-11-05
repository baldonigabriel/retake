import { describe, expect, it } from "vitest";

import { formatWeek, inWeek, parseWeek, previousWeek, weekRange } from "./week";

const iso = (d: Date) => d.toISOString();

describe("weekRange (America/Sao_Paulo, Monday–Sunday)", () => {
  it("starts on Monday 00:00 São Paulo (03:00 UTC) and ends the next Monday", () => {
    // Thursday 2026-11-05 15:00 local
    const week = weekRange(new Date("2026-11-05T18:00:00Z"));
    expect(iso(week.start)).toBe("2026-11-02T03:00:00.000Z");
    expect(iso(week.end)).toBe("2026-11-09T03:00:00.000Z");
  });

  it("puts Sunday 23:30 in São Paulo in the week that's ending, even though it's Monday in UTC", () => {
    const sundayNight = new Date("2026-11-09T02:30:00Z"); // Sun 08/11 23:30 local
    const week = weekRange(sundayNight);
    expect(iso(week.start)).toBe("2026-11-02T03:00:00.000Z");
    expect(inWeek(sundayNight, week)).toBe(true);
  });

  it("starts a new week exactly at Monday 00:00 local", () => {
    const mondayMidnight = new Date("2026-11-09T03:00:00Z");
    expect(iso(weekRange(mondayMidnight).start)).toBe("2026-11-09T03:00:00.000Z");
    expect(iso(weekRange(new Date(mondayMidnight.getTime() - 1)).start)).toBe("2026-11-02T03:00:00.000Z");
  });

  it("handles Monday itself and weeks across months and years", () => {
    expect(iso(weekRange(new Date("2026-11-02T12:00:00Z")).start)).toBe("2026-11-02T03:00:00.000Z");
    expect(iso(weekRange(new Date("2027-01-01T12:00:00Z")).start)).toBe("2026-12-28T03:00:00.000Z");
  });

  it("doesn't depend on the server's own time zone", () => {
    // Same instant, computed for another zone, gives another week boundary.
    const t = new Date("2026-11-09T02:30:00Z");
    expect(iso(weekRange(t, "UTC").start)).toBe("2026-11-09T00:00:00.000Z");
    expect(iso(weekRange(t).start)).toBe("2026-11-02T03:00:00.000Z");
  });

  it("follows a daylight-saving zone correctly", () => {
    // New York switched to EST on 2026-11-01: Monday 02/11 starts at 05:00 UTC.
    expect(iso(weekRange(new Date("2026-11-05T12:00:00Z"), "America/New_York").start)).toBe("2026-11-02T05:00:00.000Z");
    expect(iso(weekRange(new Date("2026-07-15T12:00:00Z"), "America/New_York").start)).toBe("2026-07-13T04:00:00.000Z");
  });
});

describe("previousWeek", () => {
  it("is the 7 days right before", () => {
    const prev = previousWeek(weekRange(new Date("2026-11-05T18:00:00Z")));
    expect(iso(prev.start)).toBe("2026-10-26T03:00:00.000Z");
    expect(iso(prev.end)).toBe("2026-11-02T03:00:00.000Z");
  });
});

describe("parseWeek / formatWeek", () => {
  it("defaults to the current week", () => {
    expect(parseWeek("last")).toBe("last");
    expect(parseWeek("x")).toBe("current");
    expect(parseWeek(undefined)).toBe("current");
  });

  it("labels the week in pt-BR", () => {
    expect(formatWeek(weekRange(new Date("2026-11-05T18:00:00Z")))).toBe("2 – 8 de nov");
    expect(formatWeek(weekRange(new Date("2026-10-28T18:00:00Z")))).toBe("26 de out – 1 de nov");
  });
});
