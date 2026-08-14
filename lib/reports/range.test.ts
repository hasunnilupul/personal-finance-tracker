import { describe, expect, it } from "vitest";

import {
  DEFAULT_RANGE,
  MAX_TREND_MONTHS,
  monthsIn,
  resolveRange,
  toDateFilter,
} from "@/lib/reports/range";

const NOW = new Date("2026-08-13T06:00:00.000Z");

describe("resolveRange", () => {
  describe("presets", () => {
    it.each([
      ["this-month", "2026-08-01", "2026-08-31"],
      ["last-3-months", "2026-06-01", "2026-08-31"],
      ["last-6-months", "2026-03-01", "2026-08-31"],
      ["last-12-months", "2025-09-01", "2026-08-31"],
      ["this-year", "2026-01-01", "2026-12-31"],
    ])("%s spans %s to %s", (range, from, to) => {
      const resolved = resolveRange({ range }, NOW);

      expect(resolved.from).toBe(from);
      expect(resolved.to).toBe(to);
    });

    it("ends every preset on a whole month, so the last trend column is a full bucket", () => {
      for (const range of ["this-month", "last-3-months", "last-6-months"]) {
        expect(resolveRange({ range }, NOW).to).toBe("2026-08-31");
      }
    });
  });

  describe("custom ranges", () => {
    it("keeps a valid pair", () => {
      const resolved = resolveRange({ range: "custom", from: "2026-02-10", to: "2026-04-20" }, NOW);

      expect(resolved.key).toBe("custom");
      expect(resolved.from).toBe("2026-02-10");
      expect(resolved.to).toBe("2026-04-20");
    });

    it("infers custom from a bare date pair with no range name", () => {
      expect(resolveRange({ from: "2026-02-10", to: "2026-04-20" }, NOW).key).toBe("custom");
    });

    it("labels a single-day range once rather than twice", () => {
      const resolved = resolveRange({ range: "custom", from: "2026-02-10", to: "2026-02-10" }, NOW);

      expect(resolved.label).toBe("10 Feb 2026");
    });
  });

  describe("junk falls back rather than being trusted", () => {
    // The same rule the transaction filters follow. A range that reached the
    // query as NaN or reversed would return nothing and read as "no data"
    // rather than as a bad URL.
    it.each([
      ["an unknown preset", { range: "last-900-years" }],
      ["a reversed pair", { range: "custom", from: "2026-09-01", to: "2026-02-01" }],
      ["a half-filled pair", { range: "custom", from: "2026-09-01" }],
      ["a date that does not exist", { range: "custom", from: "2026-02-31", to: "2026-03-01" }],
      ["a SQL-ish string", { from: "2026-01-01'; drop table expenses;--", to: "2026-03-01" }],
      ["an empty range name", { range: "" }],
    ])("falls back for %s", (_label, params) => {
      expect(resolveRange(params, NOW).key).toBe(DEFAULT_RANGE);
    });

    it("falls back to a range that can be built from the clock alone", () => {
      // The default can never be `custom` — there would be no dates to use.
      expect(DEFAULT_RANGE).not.toBe("custom");
    });
  });
});

describe("toDateFilter", () => {
  it.each(["2026-01-01", "2026-12-31", "2024-02-29"])("accepts the real date %s", (value) => {
    expect(toDateFilter(value)).toBe(value);
  });

  it.each(["2026-02-31", "2026-13-01", "26-01-01", "2026-1-1", "", "abc", undefined])(
    "rejects %o",
    (value) => {
      expect(toDateFilter(value)).toBeUndefined();
    },
  );
});

describe("monthsIn", () => {
  it("gives one bucket per month the range touches", () => {
    expect(monthsIn(resolveRange({ range: "last-6-months" }, NOW))).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("counts a partial month at each end as a whole bucket", () => {
    const range = resolveRange({ range: "custom", from: "2026-02-10", to: "2026-04-20" }, NOW);

    expect(monthsIn(range)).toEqual(["2026-02", "2026-03", "2026-04"]);
  });

  it("caps a hand-edited range spanning centuries", () => {
    // Otherwise the page would be asked to render thousands of columns.
    const range = resolveRange({ range: "custom", from: "2000-01-01", to: "2099-12-31" }, NOW);

    expect(monthsIn(range)).toHaveLength(MAX_TREND_MONTHS);
  });

  it("returns the months in order", () => {
    const months = monthsIn(resolveRange({ range: "last-12-months" }, NOW));

    expect([...months].sort()).toEqual(months);
  });
});
