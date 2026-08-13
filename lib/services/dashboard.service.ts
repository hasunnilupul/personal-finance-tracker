import { budgetService } from "@/lib/services/budget.service";
import { transactionService } from "@/lib/services/transaction.service";
import { SpaceContext } from "@/lib/services/types";
import { TransactionKind, TransactionListItem } from "@/lib/db/models/transaction.model";
import { BudgetWithProgress } from "@/lib/db/models/budget.model";
import { currentMonthKey, monthWindow } from "@/lib/budgets/period";

/**
 * How many recent entries the dashboard lists.
 *
 * Short on purpose — it is a glance at what just happened, not a second
 * transactions page. The list links through to the real one.
 */
export const RECENT_LIMIT = 6;

/**
 * How many budgets the health card shows before linking through.
 *
 * Sorted so the ones in trouble come first, which is the only reason to look.
 */
export const BUDGET_HEALTH_LIMIT = 4;

/**
 * A recent entry, tagged with which side it came from.
 *
 * Expenses and income are separate tables, so a merged list has to carry the
 * kind with each row — it is what decides the sign and the colour.
 */
export interface RecentEntry extends TransactionListItem {
  kind: TransactionKind;
}

/**
 * The month's totals in the space's base currency.
 */
export interface MonthTotals {
  income: string;
  expense: string;
  net: string;
}

/**
 * Everything the dashboard shows for the current month.
 */
export interface DashboardData {
  /** "August 2026". */
  monthLabel: string;
  totals: MonthTotals;
  recent: RecentEntry[];
  budgets: BudgetWithProgress[];
  /** Budgets in effect this month, of which `budgets` is the worst few. */
  budgetCount: number;
  overCount: number;
}

/**
 * The dashboard: this month's totals, what was added recently, and which
 * budgets are in trouble.
 *
 * A composition over the other services rather than a layer with queries of its
 * own — the month's spend is already what the budgets page computes, and the
 * recent list is the transaction list asked for one short page. Duplicating
 * either would mean two versions of a figure that has to agree.
 */
export class DashboardService {
  async getDashboard(ctx: SpaceContext): Promise<DashboardData> {
    const month = currentMonthKey();
    const window = monthWindow(month);

    // The transaction filters take `YYYY-MM-DD`; the window is the same
    // calendar month the budgets page measures against, so the dashboard's
    // "spent this month" and the budget bars can never disagree.
    const filters = {
      from: window.start.toISOString().slice(0, 10),
      to: window.end.toISOString().slice(0, 10),
    };

    const [incomeTotal, expenseTotal, recentExpenses, recentIncome, overview] = await Promise.all([
      transactionService.total(ctx, "income", filters),
      transactionService.total(ctx, "expense", filters),
      transactionService.list(ctx, "expense", { page: 1, pageSize: RECENT_LIMIT }),
      transactionService.list(ctx, "income", { page: 1, pageSize: RECENT_LIMIT }),
      budgetService.getOverview(ctx, month),
    ]);

    const monthly = overview.monthly.budgets;

    return {
      monthLabel: window.label,
      totals: {
        // Normalised to two decimals: an empty set comes back from the sum as
        // "0" rather than "0.00", and these figures sit beside report totals
        // that are already fixed to two.
        income: Number(incomeTotal).toFixed(2),
        expense: Number(expenseTotal).toFixed(2),
        net: (Number(incomeTotal) - Number(expenseTotal)).toFixed(2),
      },
      recent: mergeRecent(recentExpenses.items, recentIncome.items),
      budgets: worstFirst(monthly).slice(0, BUDGET_HEALTH_LIMIT),
      budgetCount: monthly.length,
      overCount: overview.monthly.summary.overCount,
    };
  }
}

/**
 * The most recent entries across both tables.
 *
 * Each side is asked for its own newest few and the two are merged here, rather
 * than in SQL: a `UNION` across the two tables would need every column named
 * twice and would still be sorted in the application to interleave them.
 *
 * Two entries filed on the same day break the tie on `updatedAt`, not on id:
 * the two tables have separate identity sequences, so comparing an expense's id
 * with an income's id ranks them by which table happened to be busier rather
 * than by which was touched more recently. Id is kept as the last step only to
 * make the order stable, which matters within one table.
 */
function mergeRecent(
  expenseItems: TransactionListItem[],
  incomeItems: TransactionListItem[],
): RecentEntry[] {
  const tagged: RecentEntry[] = [
    ...expenseItems.map((item) => ({ ...item, kind: "expense" as const })),
    ...incomeItems.map((item) => ({ ...item, kind: "income" as const })),
  ];

  return tagged
    .sort(
      (a, b) =>
        b.date.getTime() - a.date.getTime() ||
        b.updatedAt.getTime() - a.updatedAt.getTime() ||
        b.id - a.id,
    )
    .slice(0, RECENT_LIMIT);
}

/**
 * Budgets ordered by how much trouble they are in.
 *
 * Over first, then nearest to the limit. A dashboard card showing four of
 * twelve budgets has to show the four worth acting on, not the four that happen
 * to sort first alphabetically.
 */
function worstFirst(budgets: BudgetWithProgress[]): BudgetWithProgress[] {
  return [...budgets].sort((a, b) => b.ratio - a.ratio);
}

export const dashboardService = new DashboardService();
