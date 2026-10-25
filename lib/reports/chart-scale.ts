import { CategoryTotal } from "@/lib/db/models/report.model";

/**
 * A round number at or above the tallest column, for the top gridline.
 *
 * Axis ticks read as measurements, so they round to 1, 2 or 5 times a power of
 * ten rather than to whatever the largest entry happened to be.
 */
export function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

  return step * magnitude;
}

/** The vertical extent of a plot, in the same units as the values on it. */
export interface Domain {
  min: number;
  max: number;
}

/**
 * A domain that always contains zero.
 *
 * Every chart here is a measurement from nothing, so the baseline is never
 * allowed to float up to the smallest value — that is how a small difference
 * is made to look large. When values fall on both sides of zero the domain is
 * **symmetric**, which puts zero on the middle gridline and keeps a month that
 * that ran 50 over from looking different in size to one that ran 50 under.
 */
export function niceDomain(values: number[]): Domain {
  const high = Math.max(0, ...values);
  const low = Math.min(0, ...values);

  if (low === 0) {
    return { min: 0, max: niceMax(high) };
  }

  if (high === 0) {
    return { min: -niceMax(-low), max: 0 };
  }

  const bound = niceMax(Math.max(high, -low));

  return { min: -bound, max: bound };
}

/** Where a value sits down a plot, as a percentage from the top. */
export function percentFromTop(value: number, domain: Domain): number {
  const span = domain.max - domain.min;

  return span > 0 ? ((domain.max - value) / span) * 100 : 0;
}

/**
 * One wedge of the category donut.
 *
 * `count` is how many categories it stands for — one, except for the "Other"
 * wedge a long tail is folded into.
 */
export interface CategorySlice {
  key: string;
  name: string;
  icon: string | null;
  total: string;
  /** Share of the range's total spend, 0–1. */
  share: number;
  count: number;
}

/**
 * Reduce a ranking to at most `maxSlices` wedges.
 *
 * A donut with fourteen wedges is a colour chart, not a reading: the eye cannot
 * hold more than a handful of hues, and the tail is a sliver each anyway. So
 * when there are more categories than slots, the largest `maxSlices - 1` keep
 * their own wedge and everything after them is **summed** into one "Other".
 *
 * Takes `rows` largest first, as the report service returns them. A ranking
 * that already fits is returned untouched — folding a single category into
 * "Other" would rename it for no gain.
 */
export function foldCategories(rows: CategoryTotal[], maxSlices: number): CategorySlice[] {
  const toSlice = (row: CategoryTotal): CategorySlice => ({
    key: `${row.categoryId ?? "none"}-${row.name}`,
    name: row.name,
    icon: row.icon,
    total: row.total,
    share: row.share,
    count: 1,
  });

  if (rows.length <= maxSlices) {
    return rows.map(toSlice);
  }

  const kept = rows.slice(0, maxSlices - 1).map(toSlice);
  const tail = rows.slice(maxSlices - 1);

  // Whole cents, so a long tail does not accumulate float drift into a total
  // that no longer matches the sum of the rows printed beside it.
  const cents = tail.reduce((sum, row) => sum + Math.round(Number(row.total) * 100), 0);

  return [
    ...kept,
    {
      key: "other",
      name: "Other",
      icon: null,
      total: (cents / 100).toFixed(2),
      share: tail.reduce((sum, row) => sum + row.share, 0),
      count: tail.length,
    },
  ];
}

/** A stroke-dash description of one arc of a ring. */
export interface Arc {
  /** Painted length along the ring. */
  length: number;
  /** Distance from 12 o'clock to where the arc starts. */
  start: number;
}

/**
 * Lay wedges end to end around a ring of the given circumference.
 *
 * `gap` is cut from the **end** of every arc so neighbours are separated by
 * surface rather than by a drawn outline. It is dropped when only one wedge has
 * anything in it, because a ring of one would otherwise have a seam for no
 * neighbour to explain.
 *
 * Sizes are normalised against their own sum, so wedges always close the ring
 * exactly even if the shares they came from were rounded.
 */
export function ringArcs(sizes: number[], circumference: number, gap: number): Arc[] {
  const total = sizes.reduce((sum, size) => sum + Math.max(0, size), 0);

  if (total <= 0) {
    return sizes.map(() => ({ length: 0, start: 0 }));
  }

  const populated = sizes.filter((size) => size > 0).length;
  const cut = populated > 1 ? gap : 0;

  let consumed = 0;

  return sizes.map((size) => {
    const span = (Math.max(0, size) / total) * circumference;
    const arc = { length: Math.max(0, span - cut), start: consumed };

    consumed += span;

    return arc;
  });
}
