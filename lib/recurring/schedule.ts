/**
 * How often a template repeats.
 *
 * The column is a `varchar`, so this is the type-level guard — every write goes
 * through a zod enum at the action boundary and through the service.
 */
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export const FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
};

/**
 * How many occurrences one catch-up run will materialise for a single template.
 *
 * A daily template left dormant for two years is 730 entries; creating them all
 * in one page load would stall the request and flood the ledger in one go. The
 * run stops at this many and the next one picks up where it left off, so the
 * backlog drains over a few visits rather than in a single burst.
 */
export const MAX_CATCH_UP_PER_RUN = 60;

/**
 * The calendar day an occurrence falls on, anchored to **midday UTC**.
 *
 * The same anchor every other date in this app uses: a midnight anchor lands on
 * the previous UTC day for anyone east of Greenwich, which would file an
 * occurrence a day early and drop it out of ranges that should contain it.
 */
function atMidday(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day, 12, 0, 0, 0));
}

/** Days in a UTC month, via day zero of the next one. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The `n`th occurrence after an anchor.
 *
 * Every occurrence is computed from the **anchor**, never from the previous
 * one. Stepping month by month from the last occurrence drifts: rent anchored
 * on 31 January is clamped to 28 February, and stepping on from there gives 28
 * March, 28 April and so on for ever. Measuring from the anchor makes a clamped
 * month a one-off — 31 Jan, 28 Feb, 31 Mar — which is what "the 31st" means.
 *
 * @param anchor The first occurrence.
 * @param n How many periods after it. `0` returns the anchor's own day.
 */
export function occurrenceAt(anchor: Date, frequency: Frequency, n: number): Date {
  const year = anchor.getUTCFullYear();
  const month = anchor.getUTCMonth();
  const day = anchor.getUTCDate();

  switch (frequency) {
    case "daily":
      return atMidday(year, month, day + n);

    case "weekly":
      return atMidday(year, month, day + n * 7);

    case "monthly": {
      const target = month + n;
      const targetYear = year + Math.floor(target / 12);
      // JavaScript's modulo keeps the sign, so a negative month needs wrapping.
      const targetMonth = ((target % 12) + 12) % 12;

      return atMidday(targetYear, targetMonth, Math.min(day, daysInMonth(targetYear, targetMonth)));
    }

    case "yearly": {
      const targetYear = year + n;

      // 29 February only exists in a leap year; clamp it to the 28th elsewhere
      // rather than letting it roll into 1 March.
      return atMidday(targetYear, month, Math.min(day, daysInMonth(targetYear, month)));
    }
  }
}

/**
 * The occurrence after a given one.
 *
 * Takes the anchor as well, because "the next one" is only well defined
 * relative to the series — see {@link occurrenceAt}.
 */
export function nextOccurrence(anchor: Date, frequency: Frequency, current: Date): Date {
  const index = occurrenceIndex(anchor, frequency, current);

  return occurrenceAt(anchor, frequency, index + 1);
}

/**
 * Which occurrence a date is, counting from the anchor.
 *
 * Rounded rather than floored so a date that was clamped — 28 February in a
 * series anchored on the 31st — still identifies as its own occurrence rather
 * than the one before it.
 */
function occurrenceIndex(anchor: Date, frequency: Frequency, current: Date): number {
  const DAY = 86_400_000;

  switch (frequency) {
    case "daily":
      return Math.round((current.getTime() - anchor.getTime()) / DAY);

    case "weekly":
      return Math.round((current.getTime() - anchor.getTime()) / (DAY * 7));

    case "monthly":
      return (
        (current.getUTCFullYear() - anchor.getUTCFullYear()) * 12 +
        (current.getUTCMonth() - anchor.getUTCMonth())
      );

    case "yearly":
      return current.getUTCFullYear() - anchor.getUTCFullYear();
  }
}

/**
 * Today, at the same midday-UTC anchor occurrences use.
 *
 * Comparing a stored occurrence against `new Date()` directly would make
 * "is it due?" depend on the time of day the page happened to be loaded.
 */
export function todayAnchor(now: Date = new Date()): Date {
  return atMidday(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/**
 * Every occurrence from `nextDate` up to and including today.
 *
 * Bounded by {@link MAX_CATCH_UP_PER_RUN}, and by the template's own `endDate`
 * where it has one.
 *
 * @returns The dates to materialise, oldest first, and the `nextDate` the
 * template should be left holding. When the list is capped, that is the next
 * uncreated occurrence rather than a date in the future — so the following run
 * resumes exactly where this one stopped.
 */
export function dueOccurrences(
  options: {
    anchor: Date;
    frequency: Frequency;
    nextDate: Date;
    endDate?: Date | null;
  },
  now: Date = new Date(),
): { dates: Date[]; nextDate: Date; finished: boolean } {
  const { anchor, frequency, nextDate, endDate } = options;
  const today = todayAnchor(now);

  const dates: Date[] = [];
  let cursor = nextDate;

  while (cursor.getTime() <= today.getTime() && dates.length < MAX_CATCH_UP_PER_RUN) {
    if (endDate && cursor.getTime() > endDate.getTime()) {
      // Past its stop date: nothing more will ever be due.
      return { dates, nextDate: cursor, finished: true };
    }

    dates.push(cursor);
    cursor = nextOccurrence(anchor, frequency, cursor);
  }

  const finished = Boolean(endDate && cursor.getTime() > endDate.getTime());

  return { dates, nextDate: cursor, finished };
}
