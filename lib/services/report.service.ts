import { expenses } from "@/lib/db/schema/expenses";
import { income } from "@/lib/db/schema/income";
import {
  inPersonalLedger,
  inSpace,
  sumByCategoryWithNames,
  sumByMonth,
  sumTransactions,
} from "@/lib/repositories/transaction-query";
import { SpaceContext } from "@/lib/services/types";
import {
  CategoryTotal,
  MonthlyTotals,
  ReportData,
  ReportSummary,
} from "@/lib/db/models/report.model";
import { DateRange, monthsIn } from "@/lib/reports/range";
import { MonthKey, parseMonthKey } from "@/lib/budgets/period";

/**
 * How many categories the breakdown names before folding the rest together.
 *
 * Past about seven classes adjacent bars stop being tellable apart and the
 * chart turns into a list that happens to be drawn. The tail becomes one
 * "Other" row, and the table underneath still carries every category.
 */
export const TOP_CATEGORIES = 7;

const UNCATEGORISED = "Uncategorised";
const OTHER = "Other";

const MONTH_TICK = new Intl.DateTimeFormat("en-GB", { month: "short", timeZone: "UTC" });

/**
 * "Aug" for a month key, for the trend axis.
 */
function monthLabel(key: MonthKey): string {
  const parsed = parseMonthKey(key);

  if (!parsed) {
    return key;
  }

  return MONTH_TICK.format(new Date(Date.UTC(parsed.year, parsed.month, 1)));
}

function subtract(a: string, b: string): string {
  return (Number(a) - Number(b)).toFixed(2);
}

/**
 * Reports over a date range: what was earned, what was spent, where it went,
 * and how that moved month to month.
 *
 * Every figure is in the space's base currency — the queries sum `baseAmount`,
 * so a range holding entries in four currencies still adds up.
 */
export class ReportService {
  /**
   * Everything the reports page draws, in four queries.
   *
   * Both totals, the category breakdown and the monthly buckets are
   * independent, so they go out together rather than in sequence.
   */
  async getReport(ctx: SpaceContext, range: DateRange): Promise<ReportData> {
    const filters = { from: range.from, to: range.to };

    // A personal report covers its owner's spending wherever they filed it,
    // including the shared spaces they spend from — that is the whole point of
    // a personal ledger, and a report that left it out would disagree with the
    // dashboard beside it. A shared space's report stays inside the space.
    //
    // The category breakdown therefore names categories from more than one
    // space, and two spaces may each have a "Groceries". They stay separate
    // rows: they are separate categories, and folding them together on a name
    // match would be a coupling nobody could see when they renamed one.
    const spending = ctx.isPersonal ? inPersonalLedger(ctx.userId) : inSpace(ctx.organizationId);
    const earning = inSpace(ctx.organizationId);

    const [incomeTotal, expenseTotal, categoryRows, expenseByMonth, incomeByMonth] =
      await Promise.all([
        sumTransactions(income, earning, filters),
        sumTransactions(expenses, spending, filters),
        sumByCategoryWithNames(expenses, spending, filters),
        sumByMonth(expenses, spending, filters),
        sumByMonth(income, earning, filters),
      ]);

    return {
      summary: this.toSummary(incomeTotal, expenseTotal),
      byCategory: this.toBreakdown(categoryRows, expenseTotal),
      byMonth: monthsIn(range).map((month) => {
        const earned = incomeByMonth.get(month) ?? "0.00";
        const spent = expenseByMonth.get(month) ?? "0.00";

        return {
          month,
          label: monthLabel(month),
          income: earned,
          expense: spent,
          net: subtract(earned, spent),
        } satisfies MonthlyTotals;
      }),
    };
  }

  private toSummary(incomeTotal: string, expenseTotal: string): ReportSummary {
    const earned = Number(incomeTotal);
    const spent = Number(expenseTotal);
    const net = earned - spent;

    return {
      income: earned.toFixed(2),
      expense: spent.toFixed(2),
      net: net.toFixed(2),
      // Undefined rather than zero when nothing was earned — see the model.
      savingsRate: earned > 0 ? net / earned : null,
    };
  }

  /**
   * The breakdown rows, largest first, with the tail folded into "Other".
   *
   * Shares are worked out against the range's whole expense total, so they sum
   * to 1 across every row including the folded one.
   */
  private toBreakdown(
    rows: {
      categoryId: number | null;
      name: string | null;
      icon: string | null;
      color: string | null;
      total: string;
    }[],
    expenseTotal: string,
  ): CategoryTotal[] {
    const total = Number(expenseTotal);
    const share = (amount: string) => (total > 0 ? Number(amount) / total : 0);

    const named = rows.map((row) => ({
      categoryId: row.categoryId,
      name: row.name ?? UNCATEGORISED,
      icon: row.icon,
      color: row.color,
      total: Number(row.total).toFixed(2),
      share: share(row.total),
    }));

    if (named.length <= TOP_CATEGORIES + 1) {
      return named;
    }

    const head = named.slice(0, TOP_CATEGORIES);
    const tail = named.slice(TOP_CATEGORIES);
    const tailTotal = tail.reduce((sum, row) => sum + Number(row.total), 0).toFixed(2);

    return [
      ...head,
      {
        categoryId: null,
        name: `${OTHER} (${tail.length})`,
        icon: null,
        color: null,
        total: tailTotal,
        share: share(tailTotal),
      },
    ];
  }
}

export const reportService = new ReportService();
