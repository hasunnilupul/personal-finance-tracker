import CategoryBreakdown from "@/components/reports/category-breakdown";
import CategoryDonut from "@/components/reports/category-donut";
import NetChart from "@/components/reports/net-chart";
import { seriesFor } from "@/components/reports/series";
import TrendChart from "@/components/reports/trend-chart";
import TrendLines from "@/components/reports/trend-lines";
import ChartViews, { ChartView } from "@/components/charts/chart-views";
import StatTile from "@/components/charts/stat-tile";
import { requireActiveSpace } from "@/lib/auth/dal";
import { reportService } from "@/lib/services/report.service";
import { DateRange } from "@/lib/reports/range";
import { formatMoney } from "@/lib/currency/format";

interface ReportBodyProps {
  /** The range on screen, already resolved from the URL. */
  range: DateRange;
}

/**
 * Everything the range control scopes: the totals, the trend and the
 * breakdown.
 *
 * One service call feeds all of it, so the parts cannot end up describing
 * different slices — and splitting them across separate boundaries would only
 * stagger parts of one answer. The trend and the breakdown each offer several
 * charts of that same data; the choice between them is the card's own and does
 * not touch the range.
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

  const series = seriesFor(showEarnings);

  // With nothing to draw there is nothing to choose between, so the card keeps
  // its one explanation instead of offering tabs over it.
  const trendViews: ChartView[] =
    report.byMonth.length === 0
      ? [
          {
            key: "columns",
            label: "Columns",
            content: (
              <p className="text-muted-foreground py-8 text-center text-sm">
                This range does not cover a whole month.
              </p>
            ),
          },
        ]
      : [
          {
            key: "columns",
            label: "Columns",
            content: <TrendChart months={report.byMonth} baseCurrency={currency} series={series} />,
          },
          {
            key: "lines",
            label: "Lines",
            content: <TrendLines months={report.byMonth} baseCurrency={currency} series={series} />,
          },
          // A shared space records no income, so there is nothing to net.
          ...(showEarnings
            ? [
                {
                  key: "net",
                  label: "Net",
                  heading: "Kept or overspent",
                  description: `Income less expenses and savings, by month, ${range.label}`,
                  content: <NetChart months={report.byMonth} baseCurrency={currency} />,
                },
              ]
            : []),
        ];

  const categoryViews: ChartView[] = [
    {
      key: "bars",
      label: "Bars",
      content: (
        <CategoryBreakdown
          rows={report.byCategory}
          baseCurrency={currency}
          rangeLabel={range.label.toLowerCase()}
        />
      ),
    },
    ...(report.byCategory.length > 0
      ? [
          {
            key: "donut",
            label: "Donut",
            content: <CategoryDonut rows={report.byCategory} baseCurrency={currency} />,
          },
        ]
      : []),
  ];

  return (
    <>
      <div
        className={
          showEarnings
            ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-6"
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
            label="Saved"
            value={formatMoney(summary.savings, currency)}
            accent="var(--chart-3)"
            hint={range.label}
          />
        )}

        {showEarnings && (
          <StatTile
            label="Net"
            value={formatMoney(summary.net, currency)}
            tone={isNegative ? "negative" : "positive"}
            hint={
              isNegative ? "Spent or saved more than was earned" : "Kept out of income and savings"
            }
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

        {showEarnings && (
          <StatTile
            label="Balance"
            value={formatMoney(summary.balance, currency)}
            tone={Number(summary.balance) < 0 ? "negative" : "positive"}
            hint={`${formatMoney(summary.carriedBalance, currency)} brought forward`}
          />
        )}
      </div>

      <ChartViews
        id="report-trend"
        heading={showEarnings ? "Income, expenses and savings" : "Expenses"}
        description={`By month, ${range.label}`}
        views={trendViews}
      />

      <ChartViews
        id="report-category"
        heading="Spending by category"
        description={`${formatMoney(summary.expense, currency)} across ${range.label.toLowerCase()}`}
        views={categoryViews}
      />
    </>
  );
};

export default ReportBody;
