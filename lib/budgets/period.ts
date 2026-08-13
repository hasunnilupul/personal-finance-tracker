import { BudgetPeriod } from "@/lib/db/models/budget.model";

/**
 * One period's boundaries, plus how to name it.
 *
 * Budget periods are **calendar-aligned**: a monthly budget runs the calendar
 * month and a yearly one the calendar year, regardless of the day the budget
 * was created. Rollover therefore costs nothing — on the first of the month the
 * window moves on its own, with no cron and no materialised period rows — and
 * every budget on the page shares the same window, so one grouped sum answers
 * the whole list.
 */
export interface PeriodWindow {
  period: BudgetPeriod;
  /** First instant of the period, UTC. */
  start: Date;
  /** Last instant of the period, UTC. */
  end: Date;
  /** `YYYY-MM` for a month, `YYYY` for a year — what the URL carries. */
  key: string;
  /** "August 2026" / "2026". */
  label: string;
}

/**
 * A month as the URL identifies it: `YYYY-MM`.
 *
 * Kept as a string rather than a `Date` because it is a calendar month, not an
 * instant, and because it arrives from a query parameter.
 */
export type MonthKey = string;

const MONTH_KEY = /^(\d{4})-(\d{2})$/;

/**
 * Months a budget page will navigate to.
 *
 * Bounded so a hand-edited URL cannot ask for year 0 or year 99999 and get a
 * date the formatter renders as nonsense.
 */
const MIN_YEAR = 2000;
const MAX_YEAR = 2100;

/**
 * The current month, in UTC.
 *
 * UTC throughout: a transaction date is anchored to midday UTC, so deciding
 * which month "now" falls in has to use the same calendar the entries are
 * filed against.
 */
export function currentMonthKey(now: Date = new Date()): MonthKey {
  return toMonthKey(now.getUTCFullYear(), now.getUTCMonth());
}

function toMonthKey(year: number, monthIndex: number): MonthKey {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/**
 * Reads a `YYYY-MM` month out of untrusted input.
 *
 * @returns The parsed year and zero-based month, or `null` for anything that is
 * not a real month inside the supported range.
 */
export function parseMonthKey(value: string | undefined): { year: number; month: number } | null {
  if (!value) {
    return null;
  }

  const match = MONTH_KEY.exec(value);

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]) - 1;

  if (year < MIN_YEAR || year > MAX_YEAR || month < 0 || month > 11) {
    return null;
  }

  return { year, month };
}

/**
 * Resolves the month a page should show, falling back to the current one.
 *
 * Junk in the query string is ignored rather than trusted — the same rule the
 * transaction filters follow.
 */
export function resolveMonthKey(value: string | undefined, now: Date = new Date()): MonthKey {
  const parsed = parseMonthKey(value);

  return parsed ? toMonthKey(parsed.year, parsed.month) : currentMonthKey(now);
}

/**
 * The month before and after a month key, for the period navigation.
 *
 * Clamped to the supported range, so the arrows stop rather than walking into
 * years the formatter cannot render sensibly.
 */
export function shiftMonth(key: MonthKey, by: number): MonthKey | null {
  const parsed = parseMonthKey(key);

  if (!parsed) {
    return null;
  }

  // Date arithmetic rather than manual carry, so December → January and the
  // year rollover come for free.
  const shifted = new Date(Date.UTC(parsed.year, parsed.month + by, 1));
  const year = shifted.getUTCFullYear();

  if (year < MIN_YEAR || year > MAX_YEAR) {
    return null;
  }

  return toMonthKey(year, shifted.getUTCMonth());
}

/**
 * The parts of a month key, falling back to the current month.
 *
 * The window builders take a key rather than parsed parts so callers can pass
 * one straight through from the URL; this is where an unusable one stops being
 * a possibility.
 */
function resolveParts(key: MonthKey): { year: number; month: number } {
  const parsed = parseMonthKey(key);

  if (parsed) {
    return parsed;
  }

  const now = new Date();

  return { year: now.getUTCFullYear(), month: now.getUTCMonth() };
}

/**
 * The calendar month a key names.
 *
 * `end` is the last millisecond of the month, so a `lte` bound includes every
 * entry filed on the final day — including the midday-UTC anchor a transaction
 * date carries.
 */
export function monthWindow(key: MonthKey): PeriodWindow {
  const parsed = resolveParts(key);

  const start = new Date(Date.UTC(parsed.year, parsed.month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(parsed.year, parsed.month + 1, 1, 0, 0, 0, 0) - 1);

  return {
    period: "monthly",
    start,
    end,
    key,
    label: MONTH_LABEL.format(start),
  };
}

/**
 * The calendar year containing a month key.
 *
 * The budgets page shows one month and the year that contains it, so the
 * yearly section follows the monthly navigation instead of needing its own.
 */
export function yearWindow(key: MonthKey): PeriodWindow {
  const parsed = resolveParts(key);

  const start = new Date(Date.UTC(parsed.year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(parsed.year + 1, 0, 1, 0, 0, 0, 0) - 1);

  return {
    period: "yearly",
    start,
    end,
    key: String(parsed.year),
    label: String(parsed.year),
  };
}

/**
 * The window a period type covers for a given month key.
 */
export function windowFor(period: BudgetPeriod, key: MonthKey): PeriodWindow {
  return period === "monthly" ? monthWindow(key) : yearWindow(key);
}

/**
 * Where a budget starts counting: the first instant of the period containing
 * `on`, anchored to midday UTC like every other date this app stores.
 *
 * Midday rather than midnight for the reason given in `transaction-query.ts` —
 * a midnight anchor lands on the previous UTC day for anyone east of Greenwich,
 * which would put a budget created on 1 August into July.
 */
export function periodStartFor(period: BudgetPeriod, on: Date = new Date()): Date {
  const year = on.getUTCFullYear();
  const month = period === "monthly" ? on.getUTCMonth() : 0;

  return new Date(Date.UTC(year, month, 1, 12, 0, 0, 0));
}

/**
 * Whether a budget was already in effect during a window.
 *
 * A budget applies to its own starting period and every one after it. Comparing
 * against `end` rather than `start` means a budget created part-way through the
 * month still counts for that month — the whole calendar period is what it
 * limits, so the figure reads "spent in August against August's limit" rather
 * than a partial total nobody asked for.
 */
export function appliesTo(startDate: Date, window: PeriodWindow): boolean {
  return startDate.getTime() <= window.end.getTime();
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
