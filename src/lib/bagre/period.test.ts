import { describe, expect, it } from "vitest";

import { badgeUntil, formatDeadline, formatPeriod, inPeriod, nextPeriodRange, periodRange } from "./period";

const iso = (d: Date) => d.toISOString();
// Thursday 2026-11-05 15:00 in São Paulo (UTC−3)
const thursday = new Date("2026-11-05T18:00:00Z");

describe("periodRange", () => {
  it("weekly is Monday 00:00 to the next Monday in São Paulo", () => {
    const r = periodRange("weekly", thursday);
    expect(iso(r.start)).toBe("2026-11-02T03:00:00.000Z");
    expect(iso(r.end)).toBe("2026-11-09T03:00:00.000Z");
  });

  it("daily is local midnight to the next midnight", () => {
    const r = periodRange("daily", thursday);
    expect(iso(r.start)).toBe("2026-11-05T03:00:00.000Z");
    expect(iso(r.end)).toBe("2026-11-06T03:00:00.000Z");
  });

  it("puts 23:30 local in that day, though it's already tomorrow in UTC", () => {
    const lateNight = new Date("2026-11-06T02:30:00Z"); // Thu 05/11 23:30 local
    expect(iso(periodRange("daily", lateNight).start)).toBe("2026-11-05T03:00:00.000Z");
  });

  it("crosses months and years", () => {
    const r = periodRange("daily", new Date("2027-01-01T01:00:00Z")); // Dec 31, 22:00 local
    expect(iso(r.start)).toBe("2026-12-31T03:00:00.000Z");
    expect(iso(r.end)).toBe("2027-01-01T03:00:00.000Z");
  });
});

describe("nextPeriodRange", () => {
  it("is the calendar period when there was none before", () => {
    expect(nextPeriodRange("weekly", thursday, null)).toEqual(periodRange("weekly", thursday));
  });

  it("is null while the latest period is still running", () => {
    expect(nextPeriodRange("weekly", thursday, new Date("2026-11-09T03:00:00Z"))).toBeNull();
  });

  it("never overlaps the previous period: daily → weekly on a Thursday gives Thursday–Sunday", () => {
    // The daily period of Wednesday ended Thursday 00:00 local.
    const r = nextPeriodRange("weekly", thursday, new Date("2026-11-05T03:00:00Z"))!;
    expect(iso(r.start)).toBe("2026-11-05T03:00:00.000Z");
    expect(iso(r.end)).toBe("2026-11-09T03:00:00.000Z");
  });

  it("weekly → daily: the next day after the week ended starts at its own midnight", () => {
    const r = nextPeriodRange("daily", new Date("2026-11-10T15:00:00Z"), new Date("2026-11-09T03:00:00Z"))!;
    expect(iso(r.start)).toBe("2026-11-10T03:00:00.000Z");
    expect(iso(r.end)).toBe("2026-11-11T03:00:00.000Z");
  });
});

describe("badgeUntil", () => {
  it("lasts until the end of the next week", () => {
    expect(iso(badgeUntil("weekly", new Date("2026-11-09T03:00:00Z")))).toBe("2026-11-16T03:00:00.000Z");
  });
  it("lasts until the end of the next day", () => {
    expect(iso(badgeUntil("daily", new Date("2026-11-06T03:00:00Z")))).toBe("2026-11-07T03:00:00.000Z");
  });
});

describe("formatting", () => {
  it("labels a week and a single day", () => {
    expect(formatPeriod(periodRange("weekly", thursday))).toBe("2 – 8 de nov");
    expect(formatPeriod(periodRange("daily", thursday))).toBe("qui, 5 de nov");
  });

  it("labels weeks across months", () => {
    expect(formatPeriod(periodRange("weekly", new Date("2026-12-02T12:00:00Z")))).toBe("30 de nov – 6 de dez");
  });

  it("says when votes stop", () => {
    expect(formatDeadline(periodRange("weekly", thursday), thursday)).toBe("domingo, 23h59");
    expect(formatDeadline(periodRange("daily", thursday), thursday)).toBe("hoje, 23h59");
  });

  it("inPeriod is half-open", () => {
    const r = periodRange("daily", thursday);
    expect(inPeriod(r.start, r)).toBe(true);
    expect(inPeriod(r.end, r)).toBe(false);
  });
});
