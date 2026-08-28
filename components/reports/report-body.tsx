import CategoryBreakdown from "@/components/reports/category-breakdown";
import TrendChart from "@/components/reports/trend-chart";
import StatTile from "@/components/charts/stat-tile";
import { Card } from "@/components/ui/card";
import { requireActiveSpace } from "@/lib/auth/dal";
import { reportService } from "@/lib/services/report.service";
import { DateRange } from "@/lib/reports/range";
import { formatMoney } from "@/lib/currency/format";

interface ReportBodyProps {
  /** The range on screen, already resolved from the URL. */
  range: DateRange;
}

/**
 * Everything the range control scopes: the four totals, the trend and the
 * breakdown.
 *
 * One service call feeds all three, so they cannot end up describing different
 * slices — and splitting them across separate boundaries would only stagger
 * three parts of one answer.
 */
const ReportBody = async ({ range }: ReportBodyProps) => {
  const { ctx, space } = await requireActiveSpace();

  const report = await reportService.getReport(ctx, range);

  const { summary } = report;
  const currency = space.baseCurrency;
  const isNegative = Number(summary.net) < 0;

  // See the dashboard: a shared space records no income, so net and savings
  // rate would be arithmetic over a zero that means "not applicable" rather
  // than "nothing came in".
  const showEarnings = space.isPersonal;

  return (
    <>
      <div
        className={
          showEarnings
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
            : "grid gap-3 sm:grid-cols-2 lg:grid-cols-2"
        }
      >
        {showEarnings && (
          <StatTile
            label="Income"
            value={formatMoney(summary.income, currency)}
            accent="var(--viz-income)"
            hint={range.label}
          />
        )}

        <StatTile
          label="Expenses"
          value={formatMoney(summary.expense, currency)}
          accent="var(--viz-expense)"
          hint={showEarnings ? `${range.label} · every space` : range.label}
        />

        {showEarnings && (
          <StatTile
            label="Net"
            value={formatMoney(summary.net, currency)}
            tone={isNegative ? "negative" : "positive"}
            hint={isNegative ? "Spent more than was earned" : "Kept out of income"}
          />
        )}

        {showEarnings && (
          <StatTile
            label="Savings rate"
            value={summary.savingsRate === null ? "—" : `${Math.round(summary.savingsRate * 100)}%`}
            hint={
              summary.savingsRate === null ? "No income in this period" : "Net as a share of income"
            }
          />
        )}
      </div>

      <Card className="p-4 sm:p-6">
        <div>
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            {showEarnings ? "Income and expenses" : "Expenses"}
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">By month, {range.label}</p>
        </div>

        {report.byMonth.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            This range does not cover a whole month.
          </p>
        ) : (
          <TrendChart months={report.byMonth} baseCurrency={currency} />
        )}
      </Card>

      <Card className="p-4 sm:p-6">
        <div>
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Spending by category
          </h2>
          <p className="text-muted-foreground mt-0.5 text-xs">
            {formatMoney(summary.expense, currency)} across {range.label.toLowerCase()}
          </p>
        </div>

        <CategoryBreakdown
          rows={report.byCategory}
          baseCurrency={currency}
          rangeLabel={range.label.toLowerCase()}
        />
      </Card>
    </>
  );
};

export default ReportBody;
