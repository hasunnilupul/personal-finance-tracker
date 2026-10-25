import { describe, expect, it } from "vitest";

import { CategoryTotal } from "@/lib/db/models/report.model";
import {
  foldCategories,
  niceDomain,
  niceMax,
  percentFromTop,
  ringArcs,
} from "@/lib/reports/chart-scale";

const category = (
  id: number | null,
  name: string,
  total: string,
  share: number,
): CategoryTotal => ({
  categoryId: id,
  name,
  icon: null,
  color: null,
  total,
  share,
});

describe("niceMax", () => {
  it.each([
    [0.4, 0.5],
    [1, 1],
    [1.2, 2],
    [4.9, 5],
    [5.1, 10],
    [730, 1000],
    [12_400, 20_000],
  ])("rounds %s up to %s", (value, expected) => {
    expect(niceMax(value)).toBe(expected);
  });

  it("gives an empty plot a unit of height rather than zero", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(-5)).toBe(1);
  });
});

describe("niceDomain", () => {
  it("starts at zero when nothing is negative", () => {
    expect(niceDomain([120, 40, 730])).toEqual({ min: 0, max: 1000 });
  });

  it("ends at zero when nothing is positive", () => {
    expect(niceDomain([-120, -40])).toEqual({ min: -200, max: 0 });
  });

  it("is symmetric when values fall on both sides, sized by the larger", () => {
    expect(niceDomain([300, -1200])).toEqual({ min: -2000, max: 2000 });
    expect(niceDomain([1200, -300])).toEqual({ min: -2000, max: 2000 });
  });

  it("never floats the baseline up to the smallest value", () => {
    expect(niceDomain([900, 950]).min).toBe(0);
  });

  it("copes with no values and with all zeros", () => {
    expect(niceDomain([])).toEqual({ min: 0, max: 1 });
    expect(niceDomain([0, 0])).toEqual({ min: 0, max: 1 });
  });
});

describe("percentFromTop", () => {
  it("puts the top of the domain at 0 and the bottom at 100", () => {
    const domain = { min: -100, max: 100 };

    expect(percentFromTop(100, domain)).toBe(0);
    expect(percentFromTop(0, domain)).toBe(50);
    expect(percentFromTop(-100, domain)).toBe(100);
  });

  it("does not divide by a zero span", () => {
    expect(percentFromTop(5, { min: 0, max: 0 })).toBe(0);
  });
});

describe("foldCategories", () => {
  const ranked = [
    category(1, "Rent", "900.00", 0.45),
    category(2, "Food", "500.00", 0.25),
    category(3, "Transport", "300.00", 0.15),
    category(4, "Fun", "200.00", 0.1),
    category(null, "Uncategorised", "100.00", 0.05),
  ];

  it("returns a ranking that already fits as it is, one wedge each", () => {
    const slices = foldCategories(ranked, 5);

    expect(slices.map((slice) => slice.name)).toEqual([
      "Rent",
      "Food",
      "Transport",
      "Fun",
      "Uncategorised",
    ]);
    expect(slices.every((slice) => slice.count === 1)).toBe(true);
  });

  it("keeps the largest and sums everything after them into one Other", () => {
    const slices = foldCategories(ranked, 3);

    expect(slices.map((slice) => slice.name)).toEqual(["Rent", "Food", "Other"]);

    const other = slices[2];

    expect(other.total).toBe("600.00");
    expect(other.share).toBeCloseTo(0.3);
    expect(other.count).toBe(3);
  });

  it("keeps the folded wedges adding up to the whole", () => {
    const slices = foldCategories(ranked, 3);
    const total = slices.reduce((sum, slice) => sum + Number(slice.total), 0);

    expect(total).toBe(2000);
  });

  it("sums in whole cents so a long tail does not drift", () => {
    const tail = Array.from({ length: 10 }, (_, index) =>
      category(index + 10, `Small ${index}`, "0.10", 0.001),
    );
    const slices = foldCategories([category(1, "Rent", "900.00", 0.9), ...tail], 2);

    expect(slices[1].total).toBe("1.00");
  });

  it("does not rename a lone category to Other", () => {
    const slices = foldCategories(ranked.slice(0, 3), 3);

    expect(slices.map((slice) => slice.name)).toEqual(["Rent", "Food", "Transport"]);
  });

  it("returns nothing for nothing", () => {
    expect(foldCategories([], 6)).toEqual([]);
  });

  it("keys the uncategorised bucket apart from a category with the same name", () => {
    const slices = foldCategories(
      [category(null, "Food", "10.00", 0.5), category(7, "Food", "10.00", 0.5)],
      6,
    );

    expect(new Set(slices.map((slice) => slice.key)).size).toBe(2);
  });
});

describe("ringArcs", () => {
  it("lays arcs end to end, each starting where the last one's span ended", () => {
    const arcs = ringArcs([1, 1, 2], 100, 0);

    expect(arcs).toEqual([
      { length: 25, start: 0 },
      { length: 25, start: 25 },
      { length: 50, start: 50 },
    ]);
  });

  it("cuts the gap from the end of each arc, not from where it starts", () => {
    const arcs = ringArcs([1, 1], 100, 2);

    expect(arcs).toEqual([
      { length: 48, start: 0 },
      { length: 48, start: 50 },
    ]);
  });

  it("closes the ring exactly even when the sizes are unrounded shares", () => {
    const arcs = ringArcs([0.333, 0.333, 0.333], 100, 0);
    const last = arcs[2];

    expect(last.start + last.length).toBeCloseTo(100);
  });

  it("draws a single wedge as a whole ring with no seam", () => {
    expect(ringArcs([5, 0, 0], 100, 2)).toEqual([
      { length: 100, start: 0 },
      { length: 0, start: 100 },
      { length: 0, start: 100 },
    ]);
  });

  it("never lets a sliver go negative", () => {
    const arcs = ringArcs([99, 1], 100, 2);

    expect(arcs[1].length).toBe(0);
    expect(arcs.every((arc) => arc.length >= 0)).toBe(true);
  });

  it("draws nothing when there is nothing to draw", () => {
    expect(ringArcs([0, 0], 100, 2)).toEqual([
      { length: 0, start: 0 },
      { length: 0, start: 0 },
    ]);
    expect(ringArcs([], 100, 2)).toEqual([]);
  });
});
