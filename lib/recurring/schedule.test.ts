import { describe, expect, it } from "vitest";

import {
  dueOccurrences,
  MAX_CATCH_UP_PER_RUN,
  nextOccurrence,
  occurrenceAt,
  todayAnchor,
} from "@/lib/recurring/schedule";

const on = (iso: string) => new Date(`${iso}T12:00:00.000Z`);
const day = (date: Date) => date.toISOString().slice(0, 10);

describe("occurrenceAt", () => {
  describe("month-end anchoring", () => {
    // The reason `startDate` exists. Stepping from the previous occurrence
    // would clamp 31 January to 28 February and then stay on the 28th for
    // ever; measuring from the anchor makes the clamp a one-off.
    it("clamps into February and returns to the 31st in March", () => {
      const anchor = on("2026-01-31");

      expect([0, 1, 2, 3, 4, 5].map((n) => day(occurrenceAt(anchor, "monthly", n)))).toEqual([
        "2026-01-31",
        "2026-02-28",
        "2026-03-31",
        "2026-04-30",
        "2026-05-31",
        "2026-06-30",
      ]);
    });

    it("uses 29 February in a leap year", () => {
      expect(day(occurrenceAt(on("2024-01-31"), "monthly", 1))).toBe("2024-02-29");
    });

    it("clamps a 31st anchor in every short month", () => {
      const anchor = on("2026-01-31");

      for (const [n, expected] of [
        [3, "2026-04-30"],
        [5, "2026-06-30"],
        [8, "2026-09-30"],
        [10, "2026-11-30"],
      ] as const) {
        expect(day(occurrenceAt(anchor, "monthly", n))).toBe(expected);
      }
    });
  });

  describe("leap day on a yearly template", () => {
    it("clamps to the 28th in common years and returns in the next leap year", () => {
      const anchor = on("2024-02-29");

      expect([0, 1, 2, 3, 4].map((n) => day(occurrenceAt(anchor, "yearly", n)))).toEqual([
        "2024-02-29",
        "2025-02-28",
        "2026-02-28",
        "2027-02-28",
        "2028-02-29",
      ]);
    });
  });

  describe("rollovers", () => {
    it("rolls a monthly series over the year boundary", () => {
      expect(day(occurrenceAt(on("2026-11-15"), "monthly", 3))).toBe("2027-02-15");
    });

    it("rolls a daily series over the month boundary", () => {
      expect(day(occurrenceAt(on("2026-01-30"), "daily", 5))).toBe("2026-02-04");
    });

    it("steps weekly in sevens", () => {
      expect(day(occurrenceAt(on("2026-08-01"), "weekly", 3))).toBe("2026-08-22");
    });
  });

  it("anchors every occurrence to midday UTC", () => {
    // The app-wide rule: a midnight anchor lands on the previous UTC day for
    // anyone east of Greenwich, filing an occurrence a day early.
    for (const frequency of ["daily", "weekly", "monthly", "yearly"] as const) {
      expect(occurrenceAt(on("2026-01-31"), frequency, 2).getUTCHours()).toBe(12);
    }
  });
});

describe("nextOccurrence", () => {
  it("matches the anchored series, including stepping out of a clamped month", () => {
    const anchor = on("2026-01-31");
    const walked: string[] = [];

    let cursor = anchor;

    for (let i = 0; i < 5; i += 1) {
      walked.push(day(cursor));
      cursor = nextOccurrence(anchor, "monthly", cursor);
    }

    // The third entry is the one that matters: from the clamped 28 February it
    // must return to 31 March, not go to 28 March.
    expect(walked).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30", "2026-05-31"]);
  });
});

describe("todayAnchor", () => {
  it("ignores the time of day", () => {
    // Otherwise whether something is due would depend on when the page was
    // loaded rather than on the date.
    expect(todayAnchor(new Date("2026-08-13T00:05:00Z")).toISOString()).toBe(
      "2026-08-13T12:00:00.000Z",
    );
    expect(todayAnchor(new Date("2026-08-13T23:30:00Z")).toISOString()).toBe(
      "2026-08-13T12:00:00.000Z",
    );
  });
});

describe("dueOccurrences", () => {
  const NOW = new Date("2026-08-13T06:00:00.000Z");

  it("catches up everything already due", () => {
    const result = dueOccurrences(
      { anchor: on("2026-06-01"), frequency: "monthly", nextDate: on("2026-06-01") },
      NOW,
    );

    expect(result.dates.map(day)).toEqual(["2026-06-01", "2026-07-01", "2026-08-01"]);
    expect(day(result.nextDate)).toBe("2026-09-01");
    expect(result.finished).toBe(false);
  });

  it("includes an occurrence falling today", () => {
    const result = dueOccurrences(
      { anchor: on("2026-08-13"), frequency: "daily", nextDate: on("2026-08-13") },
      new Date("2026-08-13T00:05:00Z"),
    );

    expect(result.dates).toHaveLength(1);
  });

  it("materialises nothing for a template that starts in the future", () => {
    const result = dueOccurrences(
      { anchor: on("2026-09-01"), frequency: "monthly", nextDate: on("2026-09-01") },
      NOW,
    );

    expect(result.dates).toHaveLength(0);
    expect(day(result.nextDate)).toBe("2026-09-01");
  });

  it("never runs ahead of today", () => {
    const result = dueOccurrences(
      { anchor: on("2026-01-01"), frequency: "monthly", nextDate: on("2026-01-01") },
      NOW,
    );

    expect(result.dates.every((date) => date.getTime() <= NOW.getTime())).toBe(true);
  });

  describe("the per-run cap", () => {
    // A daily template dormant for two years is 730 entries; creating them in
    // one page load would stall the request and flood the ledger at once.
    const dormant = () =>
      dueOccurrences(
        { anchor: on("2024-01-01"), frequency: "daily", nextDate: on("2024-01-01") },
        NOW,
      );

    it("stops at the cap", () => {
      expect(dormant().dates).toHaveLength(MAX_CATCH_UP_PER_RUN);
    });

    it("leaves nextDate on the first uncreated occurrence, so the next run resumes", () => {
      // This is what makes the backlog drain over several visits instead of
      // silently skipping the remainder.
      expect(day(dormant().nextDate)).toBe("2024-03-01");
    });

    it("resumes exactly where it stopped", () => {
      const first = dormant();
      const second = dueOccurrences(
        { anchor: on("2024-01-01"), frequency: "daily", nextDate: first.nextDate },
        NOW,
      );

      expect(day(second.dates[0])).toBe(day(first.nextDate));
    });
  });

  describe("end dates", () => {
    it("stops at the end date and reports itself finished", () => {
      const result = dueOccurrences(
        {
          anchor: on("2026-06-01"),
          frequency: "monthly",
          nextDate: on("2026-06-01"),
          endDate: on("2026-07-15"),
        },
        NOW,
      );

      expect(result.dates.map(day)).toEqual(["2026-06-01", "2026-07-01"]);
      expect(result.finished).toBe(true);
    });

    it("treats an end date on an occurrence as inclusive", () => {
      const result = dueOccurrences(
        {
          anchor: on("2026-06-01"),
          frequency: "monthly",
          nextDate: on("2026-06-01"),
          endDate: on("2026-07-01"),
        },
        NOW,
      );

      expect(result.dates.map(day)).toEqual(["2026-06-01", "2026-07-01"]);
    });
  });
});
