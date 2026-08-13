import { MonthKey, parseMonthKey, shiftMonth } from "@/lib/budgets/period";

/**
 * The date range a report is drawn over.
 *
 * `from` and `to` are `YYYY-MM-DD` strings, the same shape the transaction
 * filters use, so a range can be handed straight to `TransactionFilters` and
 * picks up the whole-UTC-day bounds those already apply.
 */
export interface DateRange {
  key: RangeKey;
  from: string;
  to: string;
  /** "This month", "Last 6 months", or "1 Jan 2026 – 31 Mar 2026". */
  label: string;
}

/**
 * The presets the picker offers, plus `custom` for a hand-picked pair.
 *
 * Presets are rows rather than a calendar, because nobody fights a date grid
 * for "the last six months". A custom range is the escape hatch underneath.
 */
export type RangeKey =
  "this-month" | "last-3-months" | "last-6-months" | "this-year" | "last-12-months" | "custom";

/**
 * Typed without `custom`, because the fallback has to be a range that can be
 * built from the clock alone — there are no dates to fall back to.
 */
export const DEFAULT_RANGE: Exclude<RangeKey, "custom"> = "last-6-months";

/**
 * Presets in the order the picker lists them.
 *
 * `custom` is deliberately absent — it is not something to pick from a list, it
 * is what choosing dates produces.
 */
export const RANGE_PRESETS: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "this-month", label: "This month" },
  { key: "last-3-months", label: "Last 3 months" },
  { key: "last-6-months", label: "Last 6 months" },
  { key: "last-12-months", label: "Last 12 months" },
  { key: "this-year", label: "This year" },
];

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A `YYYY-MM-DD` string for a UTC date.
 *
 * UTC throughout, for the reason the dates convention gives: entries are
 * anchored to midday UTC, so a range worked out in local time would include or
 * exclude the wrong day at the edges.
 */
function toDateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** First day of a month key. */
function firstOfMonth(key: MonthKey): string {
  return `${key}-01`;
}

/** Last day of a month key, via day zero of the following month. */
function lastOfMonth(key: MonthKey): string {
  const parsed = parseMonthKey(key);

  if (!parsed) {
    return firstOfMonth(key);
  }

  return toDateString(new Date(Date.UTC(parsed.year, parsed.month + 1, 0)));
}

/**
 * Accepts only a real `YYYY-MM-DD` date, ignoring anything else.
 *
 * The same rule the transaction filters follow: junk in the query string means
 * "no filter" rather than a crash or a NaN in a query. Round-tripping through
 * `Date` rejects `2026-02-31`, which the regex alone would let through.
 */
export function toDateFilter(value: string | undefined): string | undefined {
  if (!value || !DATE.test(value)) {
    return undefined;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  return Number.isNaN(parsed.getTime()) || toDateString(parsed) !== value ? undefined : value;
}

function currentMonth(now: Date): MonthKey {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Builds the range a preset names.
 *
 * Every preset ends at the end of the current month rather than at today, so a
 * trend chart's last column is a whole bucket like the others. A month that is
 * still in progress reads as low rather than as a fall — the label says which
 * month it is, and the tooltip carries the figure.
 */
function fromPreset(key: Exclude<RangeKey, "custom">, now: Date): DateRange {
  const month = currentMonth(now);
  const year = now.getUTCFullYear();

  const spans: Record<Exclude<RangeKey, "custom">, { from: string; to: string }> = {
    "this-month": { from: firstOfMonth(month), to: lastOfMonth(month) },
    "last-3-months": { from: firstOfMonth(shiftMonth(month, -2) ?? month), to: lastOfMonth(month) },
    "last-6-months": { from: firstOfMonth(shiftMonth(month, -5) ?? month), to: lastOfMonth(month) },
    "last-12-months": {
      from: firstOfMonth(shiftMonth(month, -11) ?? month),
      to: lastOfMonth(month),
    },
    "this-year": { from: `${year}-01-01`, to: `${year}-12-31` },
  };

  const label = RANGE_PRESETS.find((preset) => preset.key === key)?.label ?? key;

  return { key, ...spans[key], label };
}

const DAY_LABEL = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function customLabel(from: string, to: string): string {
  const start = DAY_LABEL.format(new Date(`${from}T00:00:00.000Z`));
  const end = DAY_LABEL.format(new Date(`${to}T00:00:00.000Z`));

  return start === end ? start : `${start} – ${end}`;
}

/**
 * Resolves the range a report page should draw, from the URL.
 *
 * A `custom` range needs both ends to be real dates in the right order; a
 * half-filled or reversed pair falls back to the default rather than querying a
 * range that cannot contain anything. Unknown preset names fall back too — the
 * same "ignore junk rather than trust it" rule the filters follow.
 */
export function resolveRange(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
): DateRange {
  const from = toDateFilter(params.from);
  const to = toDateFilter(params.to);

  if (params.range === "custom" || (!params.range && (from || to))) {
    if (from && to && from <= to) {
      return { key: "custom", from, to, label: customLabel(from, to) };
    }

    return fromPreset(DEFAULT_RANGE, now);
  }

  const preset = RANGE_PRESETS.find((option) => option.key === params.range);

  return fromPreset(preset?.key ?? DEFAULT_RANGE, now);
}

/**
 * Every month the range touches, in order.
 *
 * The trend chart plots this rather than the months that happen to have
 * entries, so a month with no spending is a gap in the line instead of being
 * skipped — which would compress the axis and misstate the shape.
 *
 * Capped so a hand-edited range spanning centuries cannot ask the page to
 * render thousands of columns.
 */
export const MAX_TREND_MONTHS = 24;

export function monthsIn(range: DateRange): MonthKey[] {
  const first = range.from.slice(0, 7);
  const last = range.to.slice(0, 7);

  const months: MonthKey[] = [];
  let cursor: MonthKey | null = first;

  while (cursor && cursor <= last && months.length < MAX_TREND_MONTHS) {
    months.push(cursor);
    cursor = shiftMonth(cursor, 1);
  }

  return months;
}
