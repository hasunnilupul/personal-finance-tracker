import { MonthKey } from "@/lib/budgets/period";

/**
 * One category's share of spending over a range.
 *
 * `categoryId` is null for the uncategorised bucket. A report that dropped
 * those rows would show a breakdown whose parts do not add up to the total it
 * prints beside them, so they are kept and named rather than filtered out.
 */
export interface CategoryTotal {
  categoryId: number | null;
  name: string;
  icon: string | null;
  color: string | null;
  total: string;
  /** Share of the range's total spend, 0–1. Zero when nothing was spent. */
  share: number;
}

/**
 * One month's income and expense, in the space's base currency.
 *
 * Both are present for every month the range covers, zero included, so the
 * trend has a point per month rather than only where entries exist.
 */
export interface MonthlyTotals {
  month: MonthKey;
  /** "Aug" — the axis tick. */
  label: string;
  income: string;
  expense: string;
  /** Personal space only — `"0.00"` in a shared space. */
  savings: string;
  /**
   * Income minus expense minus savings. Negative in a month that spent or
   * saved more than it earned.
   */
  net: string;
}

/**
 * The headline figures for a range.
 */
export interface ReportSummary {
  income: string;
  expense: string;
  /**
   * Real money set aside over the range, personal space only — `"0.00"` in a
   * shared space. Distinct from `savingsRate` below: this is what was
   * actually recorded as a saving, not a computed ratio.
   */
  savings: string;
  net: string;
  /**
   * Net as a share of income, 0–1, or `null` when there was no income to save
   * out of. A rate against zero income is not zero — it is undefined, and
   * printing "0%" would read as a real measurement. `net` already has
   * `savings` deducted, so this reflects what was left over after saving too.
   */
  savingsRate: number | null;
  /**
   * Personal space only: everything earned minus everything spent *before*
   * `range.from`. `"0.00"` in a shared space, which has no income of its own to
   * run a balance against — see the dashboard's `carriedBalance`, the same idea
   * anchored to a range instead of a calendar month.
   */
  carriedBalance: string;
  /** `carriedBalance` plus this range's own net — the balance as of `range.to`. */
  balance: string;
}

/**
 * Everything the reports page draws, for one range.
 */
export interface ReportData {
  summary: ReportSummary;
  byCategory: CategoryTotal[];
  byMonth: MonthlyTotals[];
}
