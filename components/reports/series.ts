import { MonthlyTotals } from "@/lib/db/models/report.model";

/** The figures a month carries that a chart can plot. */
export type SeriesKey = keyof Pick<MonthlyTotals, "income" | "expense" | "savings" | "net">;

export interface Series {
  key: SeriesKey;
  label: string;
  color: string;
}

export const INCOME: Series = { key: "income", label: "Income", color: "var(--viz-income)" };
export const EXPENSE: Series = { key: "expense", label: "Expenses", color: "var(--viz-expense)" };
export const SAVINGS: Series = { key: "savings", label: "Savings", color: "var(--chart-3)" };

/**
 * The series a space has anything to say about.
 *
 * A shared space records no income and no savings, so offering them would draw
 * a legend entry and a flat line along the floor for something that is not
 * "zero" but "not applicable" — the same reason the stat tiles hide them.
 */
export function seriesFor(showEarnings: boolean): Series[] {
  return showEarnings ? [INCOME, EXPENSE, SAVINGS] : [EXPENSE];
}
