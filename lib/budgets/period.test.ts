import { describe, expect, it } from "vitest";

import {
  appliesTo,
  currentMonthKey,
  monthWindow,
  parseMonthKey,
  periodStartFor,
  resolveMonthKey,
  shiftMonth,
  windowFor,
  yearWindow,
} from "@/lib/budgets/period";

const NOW = new Date("2026-08-13T06:00:00.000Z");

describe("parseMonthKey", () => {
  it("reads a well-formed key", () => {
    expect(parseMonthKey("2026-08")).toEqual({ year: 2026, month: 7 });
  });

  it.each(["", "2026", "2026-13", "2026-00", "26-08", "2026-8", "abc", undefined])(
    "rejects %o",
    (value) => {
      expect(parseMonthKey(value)).toBeNull();
    },
  );

  it("rejects years outside the supported range", () => {
    // Bounded so a hand-edited URL cannot ask for a date the formatter renders
    // as nonsense.
    expect(parseMonthKey("1999-08")).toBeNull();
    expect(parseMonthKey("2101-08")).toBeNull();
    expect(parseMonthKey("2000-01")).not.toBeNull();
    expect(parseMonthKey("2100-12")).not.toBeNull();
  });
});

describe("resolveMonthKey", () => {
  it("keeps a valid key", () => {
    expect(resolveMonthKey("2026-03", NOW)).toBe("2026-03");
  });

  it.each(["2026-13", "junk", "", undefined])("falls back to the current month for %o", (value) => {
    expect(resolveMonthKey(value, NOW)).toBe(currentMonthKey(NOW));
  });
});

describe("currentMonthKey", () => {
  it("uses UTC, matching the calendar entries are filed against", () => {
    // Late on the 31st in UTC+X is still August in UTC.
    expect(currentMonthKey(new Date("2026-08-31T23:59:00Z"))).toBe("2026-08");
    expect(currentMonthKey(new Date("2026-09-01T00:01:00Z"))).toBe("2026-09");
  });
});

describe("shiftMonth", () => {
  it("moves forward and back", () => {
    expect(shiftMonth("2026-08", 1)).toBe("2026-09");
    expect(shiftMonth("2026-08", -1)).toBe("2026-07");
  });

  it("rolls over the year in both directions", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("stops at the supported range rather than walking out of it", () => {
    expect(shiftMonth("2100-12", 1)).toBeNull();
    expect(shiftMonth("2000-01", -1)).toBeNull();
  });
});

describe("monthWindow", () => {
  it("covers the whole calendar month", () => {
    const window = monthWindow("2026-08");

    expect(window.start.toISOString()).toBe("2026-08-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-08-31T23:59:59.999Z");
  });

  it("includes an entry filed at the midday anchor on the last day", () => {
    // The bound has to contain the midday-UTC anchor a transaction date
    // carries, or the final day of every month would drop out.
    const window = monthWindow("2026-08");
    const lastDay = new Date("2026-08-31T12:00:00.000Z");

    expect(lastDay.getTime()).toBeLessThanOrEqual(window.end.getTime());
    expect(lastDay.getTime()).toBeGreaterThanOrEqual(window.start.getTime());
  });

  it("handles February in a leap year", () => {
    expect(monthWindow("2024-02").end.toISOString()).toBe("2024-02-29T23:59:59.999Z");
    expect(monthWindow("2026-02").end.toISOString()).toBe("2026-02-28T23:59:59.999Z");
  });

  it("labels the month for a reader", () => {
    expect(monthWindow("2026-08").label).toBe("August 2026");
  });
});

describe("yearWindow", () => {
  it("covers the calendar year containing the month", () => {
    const window = yearWindow("2026-08");

    expect(window.start.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(window.end.toISOString()).toBe("2026-12-31T23:59:59.999Z");
    expect(window.label).toBe("2026");
  });
});

describe("windowFor", () => {
  it("picks the window matching the period type", () => {
    expect(windowFor("monthly", "2026-08").key).toBe("2026-08");
    expect(windowFor("yearly", "2026-08").key).toBe("2026");
  });
});

describe("periodStartFor", () => {
  it("anchors a monthly budget to the 1st at midday UTC", () => {
    expect(periodStartFor("monthly", NOW).toISOString()).toBe("2026-08-01T12:00:00.000Z");
  });

  it("anchors a yearly budget to 1 January", () => {
    // A monthly limit turned yearly needs the start of the year, or it would be
    // excluded from its own first year.
    expect(periodStartFor("yearly", NOW).toISOString()).toBe("2026-01-01T12:00:00.000Z");
  });
});

describe("appliesTo", () => {
  const august = monthWindow("2026-08");

  it("applies to the period it started in", () => {
    expect(appliesTo(new Date("2026-08-01T12:00:00Z"), august)).toBe(true);
  });

  it("applies to a budget created part-way through the month", () => {
    // The whole calendar period is what a budget limits, so the figure reads
    // "spent in August against August's limit" rather than a partial total.
    expect(appliesTo(new Date("2026-08-20T12:00:00Z"), august)).toBe(true);
  });

  it("applies to every later period", () => {
    expect(appliesTo(new Date("2026-01-01T12:00:00Z"), august)).toBe(true);
  });

  it("does not apply before it started", () => {
    // Showing next month's limit against this month's spend would be a figure
    // about nothing.
    expect(appliesTo(new Date("2026-09-01T12:00:00Z"), august)).toBe(false);
  });
});
