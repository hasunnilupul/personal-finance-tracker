import { DailyTotal } from "@/lib/db/models/report.model";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const cents = (amount: string) => Math.round(Number(amount) * 100);

/** `2026-08-14` → `{ month: 7, day: 14 }`, with the month zero-based. */
function parts(date: string): { month: number; day: number } {
  return { month: Number(date.slice(5, 7)) - 1, day: Number(date.slice(8, 10)) };
}

export interface DaySummary {
  /** Everything spent over the days that have happened. */
  total: string;
  /** Per day that has happened, or `null` when none has. */
  average: string | null;
  /** The day the most went out; `null` when nothing was spent. */
  busiest: { date: string; expense: string } | null;
  /** Days that have happened and had no spending. */
  quietDays: number;
  /** How many days have happened — the divisor of `average`. */
  elapsed: number;
}

/**
 * The few figures that say what a run of days looked like.
 *
 * **Days still to come are not counted.** A range ends at the end of its last
 * month, so the 20 days after today would otherwise drag the average down and
 * pad the count of quiet days with days nobody has had yet. The total is
 * unaffected — nothing can have been spent on them — but it is summed over the
 * same days for the same reason.
 *
 * The busiest day is the first of any tie, so the answer does not depend on how
 * the rows happen to be ordered beyond their being in date order.
 */
export function summariseDays(days: DailyTotal[]): DaySummary {
  const elapsedDays = days.filter((day) => !day.isFuture);

  const totalCents = elapsedDays.reduce((sum, day) => sum + cents(day.expense), 0);

  let busiest: DaySummary["busiest"] = null;
  let busiestCents = 0;

  for (const day of elapsedDays) {
    if (cents(day.expense) > busiestCents) {
      busiestCents = cents(day.expense);
      busiest = { date: day.date, expense: day.expense };
    }
  }

  return {
    total: (totalCents / 100).toFixed(2),
    average: elapsedDays.length > 0 ? (totalCents / elapsedDays.length / 100).toFixed(2) : null,
    busiest,
    quietDays: elapsedDays.filter((day) => cents(day.expense) === 0).length,
    elapsed: elapsedDays.length,
  };
}

export interface DayTick {
  index: number;
  label: string;
}

/** Days of the month that carry a label on a short range: the 1st and each week after. */
const WEEK_MARKS = new Set([1, 8, 15, 22]);

/** A label closer than this to the first column is dropped, so the two cannot collide. */
const MIN_GAP_FROM_START = 4;

/** More month labels than this do not fit across a card. */
const MAX_MONTH_TICKS = 8;

/**
 * Where to put labels along a run of days.
 *
 * What is readable depends on how many columns there are. Up to about two
 * months a label per week fits, and the day of the month is what a reader
 * wants ("what happened on the 15th"). Past that there is room only for the
 * month, so it is labelled where it begins.
 *
 * The first column of a short range is always labelled, since a range that
 * starts on the 3rd would otherwise open on an unmarked axis. Month labels are
 * thinned from the end, like the monthly chart's, so the most recent month —
 * the one being read — always keeps its label.
 */
export function dayTicks(dates: string[]): DayTick[] {
  if (dates.length === 0) {
    return [];
  }

  if (dates.length <= 62) {
    const ticks: DayTick[] = [];

    dates.forEach((date, index) => {
      const { month, day } = parts(date);

      if (index === 0) {
        ticks.push({ index, label: `${day} ${MONTHS[month]}` });
      } else if (WEEK_MARKS.has(day) && index >= MIN_GAP_FROM_START) {
        ticks.push({ index, label: day === 1 ? `1 ${MONTHS[month]}` : String(day) });
      }
    });

    return ticks;
  }

  const starts = dates
    .map((date, index) => ({ index, ...parts(date) }))
    .filter(({ day }) => day === 1)
    .map(({ index, month }) => ({ index, label: MONTHS[month] }));

  const every = Math.ceil(starts.length / MAX_MONTH_TICKS);

  return starts.filter((_, position) => (starts.length - 1 - position) % every === 0);
}
