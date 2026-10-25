"use client";

import ChartTable from "@/components/charts/chart-table";
import MonthPlot from "@/components/reports/month-plot";
import { EXPENSE, INCOME, SAVINGS, Series } from "@/components/reports/series";
import { MonthlyTotals } from "@/lib/db/models/report.model";
import { formatMoney } from "@/lib/currency/format";
import { niceDomain, percentFromTop } from "@/lib/reports/chart-scale";

interface NetChartProps {
  months: MonthlyTotals[];
  baseCurrency: string;
}

const NET: Series = { key: "net", label: "Net", color: "var(--foreground)" };

/**
 * What each month left over, or ran short by.
 *
 * One figure per month — income minus expenses minus savings — drawn from a
 * zero line: up when more came in than went out or was set aside, down when it
 * did not. That is the one thing the other views make the reader subtract in
 * their head.
 *
 * Colour repeats what the position already says, using the two hues the page
 * already means "in" and "out" by, so it is never the only signal. The domain is
 * symmetric about zero when months fall on both sides, so a gap of 50 looks the
 * same size above the line as below it.
 *
 * The tooltip lists the three figures the net is made of, because a bar that
 * says "-120" invites the question of from what.
 */
const NetChart = ({ months, baseCurrency }: NetChartProps) => {
  if (months.length === 0) {
    return null;
  }

  const domain = niceDomain(months.map((month) => Number(month.net)));
  const zeroAt = percentFromTop(0, domain);

  return (
    <>
      <MonthPlot
        months={months}
        baseCurrency={baseCurrency}
        domain={domain}
        legend={[
          { label: "Kept out of income and savings", color: INCOME.color },
          { label: "Spent or saved more than earned", color: EXPENSE.color },
        ]}
        readout={[INCOME, EXPENSE, SAVINGS, NET]}
        renderBand={(month) => {
          const net = Number(month.net);
          const at = percentFromTop(net, domain);
          const kept = net >= 0;

          return (
            <div
              className={
                kept
                  ? "absolute left-1/2 w-full max-w-[20px] -translate-x-1/2 rounded-t-[4px]"
                  : "absolute left-1/2 w-full max-w-[20px] -translate-x-1/2 rounded-b-[4px]"
              }
              style={{
                top: `${kept ? at : zeroAt}%`,
                height: `${Math.abs(at - zeroAt)}%`,
                backgroundColor: kept ? INCOME.color : EXPENSE.color,
              }}
            />
          );
        }}
      />

      <ChartTable
        summary="Show the figures"
        columns={["Month", "Income", "Expenses", "Savings", "Net"]}
        rows={months.map((month) => [
          `${month.label} ${month.month.slice(0, 4)}`,
          formatMoney(month.income, baseCurrency),
          formatMoney(month.expense, baseCurrency),
          formatMoney(month.savings, baseCurrency),
          formatMoney(month.net, baseCurrency),
        ])}
      />
    </>
  );
};

export default NetChart;
