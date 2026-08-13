import CategoryBreakdown from "@/components/reports/category-breakdown";
import ReportRangePicker from "@/components/reports/report-range-picker";
import TrendChart from "@/components/reports/trend-chart";
import StatTile from "@/components/charts/stat-tile";
import { Card } from "@/components/ui/card";
import { requireActiveSpace } from "@/lib/auth/dal";
import { reportService } from "@/lib/services/report.service";
import { resolveRange } from "@/lib/reports/range";
import { formatMoney } from "@/lib/currency/format";

interface ReportsPageProps {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}

/**
 * Reports over a date range: what came in, what went out, where it went, and
 * how that moved month to month.
 *
 * One range control at the top scopes every figure on the page, so the totals,
 * the breakdown and the trend can never be showing different slices. The range
 * comes from the URL, so the page stays a Server Component and a particular
 * view can be bookmarked.
 */
const ReportsPage = async ({ searchParams }: ReportsPageProps) => {
  const params = await searchParams;
  const { ctx, space } = await requireActiveSpace();

  const range = resolveRange(params);
  const report = await reportService.getReport(ctx, range);

  const { summary } = report;
  const currency = space.baseCurrency;
  const isNegative = Number(summary.net) < 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Income and spending over a period, in {currency}.
        </p>
      </div>

      <ReportRangePicker basePath="/reports" range={range} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Income"
          value={formatMoney(summary.income, currency)}
          accent="var(--viz-income)"
          hint={range.label}
        />
        <StatTile
          label="Expenses"
          value={formatMoney(summary.expense, currency)}
          accent="var(--viz-expense)"
          hint={range.label}
        />
        <StatTile
          label="Net"
          value={formatMoney(summary.net, currency)}
          tone={isNegative ? "negative" : "positive"}
          hint={isNegative ? "Spent more than was earned" : "Kept out of income"}
        />
        <StatTile
          label="Savings rate"
          value={summary.savingsRate === null ? "—" : `${Math.round(summary.savingsRate * 100)}%`}
          hint={
            summary.savingsRate === null ? "No income in this period" : "Net as a share of income"
          }
        />
      </div>

      <Card className="p-4 sm:p-6">
        <div>
          <h2 className="text-foreground text-lg font-semibold tracking-tight">
            Income and expenses
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
    </div>
  );
};

export default ReportsPage;
