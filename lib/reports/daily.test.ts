import { describe, expect, it } from "vitest";

import { DailyTotal } from "@/lib/db/models/report.model";
import { dayTicks, summariseDays } from "@/lib/reports/daily";
import { daysIn, MAX_DAILY_DAYS } from "@/lib/reports/range";

const day = (date: string, expense: string, isFuture = false): DailyTotal => ({
  date,
  expense,
  isFuture,
});

const range = (from: string, to: string) => ({ key: "custom" as const, from, to, label: "" });

describe("daysIn", () => {
  it("lists every day from the first to the last, inclusive", () => {
    expect(daysIn(range("2026-08-30", "2026-09-02"))).toEqual([
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });

  it("is a single day when the ends are the same", () => {
    expect(daysIn(range("2026-08-14", "2026-08-14"))).toEqual(["2026-08-14"]);
  });

  it("knows a leap February from an ordinary one", () => {
    expect(daysIn(range("2028-02-01", "2028-02-29"))).toHaveLength(29);
    expect(daysIn(range("2027-02-01", "2027-02-28"))).toHaveLength(28);
  });

  it("steps across a clock change without losing or repeating a day", () => {
    // Daylight saving would shift a local-time walk by an hour here; UTC does not.
    const days = daysIn(range("2026-03-27", "2026-03-31"));

    expect(days).toEqual(["2026-03-27", "2026-03-28", "2026-03-29", "2026-03-30", "2026-03-31"]);
  });

  it("draws a whole year, and refuses one day more", () => {
    expect(daysIn(range("2026-01-01", "2026-12-31"))).toHaveLength(365);
    expect(daysIn(range("2028-01-01", "2028-12-31"))).toHaveLength(MAX_DAILY_DAYS);
    expect(daysIn(range("2026-01-01", "2027-01-01"))).toHaveLength(MAX_DAILY_DAYS);
    expect(daysIn(range("2026-01-01", "2027-01-02"))).toHaveLength(0);
  });

  it("returns nothing, not a truncated run, for a range too long to draw", () => {
    expect(daysIn(range("2000-01-01", "2026-12-31"))).toEqual([]);
  });

  it("returns nothing for a reversed or unreadable range", () => {
    expect(daysIn(range("2026-09-02", "2026-09-01"))).toEqual([]);
    expect(daysIn(range("nope", "2026-09-01"))).toEqual([]);
  });
});

describe("summariseDays", () => {
  it("totals, averages and finds the busiest day", () => {
    const summary = summariseDays([
      day("2026-08-01", "10.00"),
      day("2026-08-02", "0.00"),
      day("2026-08-03", "35.50"),
      day("2026-08-04", "4.50"),
    ]);

    expect(summary.total).toBe("50.00");
    expect(summary.average).toBe("12.50");
    expect(summary.busiest).toEqual({ date: "2026-08-03", expense: "35.50" });
    expect(summary.quietDays).toBe(1);
    expect(summary.elapsed).toBe(4);
  });

  it("leaves days still to come out of the average and the quiet days", () => {
    const summary = summariseDays([
      day("2026-08-01", "30.00"),
      day("2026-08-02", "0.00"),
      day("2026-08-03", "0.00", true),
      day("2026-08-04", "0.00", true),
    ]);

    expect(summary.elapsed).toBe(2);
    expect(summary.average).toBe("15.00");
    expect(summary.quietDays).toBe(1);
  });

  it("takes the first of two equally busy days", () => {
    const summary = summariseDays([day("2026-08-01", "20.00"), day("2026-08-02", "20.00")]);

    expect(summary.busiest?.date).toBe("2026-08-01");
  });

  it("has no busiest day, rather than a zero one, when nothing was spent", () => {
    const summary = summariseDays([day("2026-08-01", "0.00"), day("2026-08-02", "0.00")]);

    expect(summary.busiest).toBeNull();
    expect(summary.total).toBe("0.00");
    expect(summary.average).toBe("0.00");
    expect(summary.quietDays).toBe(2);
  });

  it("has no average, rather than a zero one, when no day has happened", () => {
    const summary = summariseDays([day("2026-12-01", "0.00", true)]);

    expect(summary.average).toBeNull();
    expect(summary.elapsed).toBe(0);
    expect(summary.quietDays).toBe(0);
  });

  it("copes with no days at all", () => {
    expect(summariseDays([])).toEqual({
      total: "0.00",
      average: null,
      busiest: null,
      quietDays: 0,
      elapsed: 0,
    });
  });

  it("sums in whole cents so many small days do not drift", () => {
    const days = Array.from({ length: 30 }, (_, index) =>
      day(`2026-08-${String(index + 1).padStart(2, "0")}`, "0.10"),
    );

    expect(summariseDays(days).total).toBe("3.00");
  });
});

describe("dayTicks", () => {
  const run = (from: string, to: string) => daysIn(range(from, to));

  it("labels the first day, then the 8th, 15th and 22nd, on a month", () => {
    const ticks = dayTicks(run("2026-08-01", "2026-08-31"));

    expect(ticks.map((tick) => tick.label)).toEqual(["1 Aug", "8", "15", "22"]);
    expect(ticks.map((tick) => tick.index)).toEqual([0, 7, 14, 21]);
  });

  it("names the month where a short range crosses into the next", () => {
    const ticks = dayTicks(run("2026-08-10", "2026-09-20"));

    expect(ticks.map((tick) => tick.label)).toEqual(["10 Aug", "15", "22", "1 Sep", "8", "15"]);
  });

  it("always labels the first day of a short range, even a lone one", () => {
    expect(dayTicks(run("2026-08-03", "2026-08-06")).map((tick) => tick.label)).toEqual(["3 Aug"]);
    expect(dayTicks(run("2026-08-14", "2026-08-14")).map((tick) => tick.label)).toEqual(["14 Aug"]);
  });

  it("drops a weekly label that would sit on top of the first one", () => {
    // Opens on the 6th: the 8th is two columns away and would collide with it.
    const labels = dayTicks(run("2026-08-06", "2026-08-31")).map((tick) => tick.label);

    expect(labels).toEqual(["6 Aug", "15", "22"]);
  });

  it("switches to month names where days would not fit", () => {
    const ticks = dayTicks(run("2026-01-01", "2026-06-30"));

    expect(ticks.map((tick) => tick.label)).toEqual(["Jan", "Feb", "Mar", "Apr", "May", "Jun"]);
  });

  it("thins a year of months from the end, so the latest keeps its label", () => {
    const ticks = dayTicks(run("2026-01-01", "2026-12-31"));

    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks[ticks.length - 1].label).toBe("Dec");
    // Every other month, counted back from the last.
    expect(ticks.map((tick) => tick.label)).toEqual(["Feb", "Apr", "Jun", "Aug", "Oct", "Dec"]);
  });

  it("does not label a month the range only just touches before it has begun", () => {
    // 3 Oct → 31 Dec: no 1st of October, so October is unlabelled.
    const ticks = dayTicks(run("2026-10-03", "2026-12-31"));

    expect(ticks.map((tick) => tick.label)).toEqual(["Nov", "Dec"]);
  });

  it("returns nothing for nothing", () => {
    expect(dayTicks([])).toEqual([]);
  });
});
