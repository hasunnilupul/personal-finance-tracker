"use client";

import ChartTable from "@/components/charts/chart-table";
import MonthPlot from "@/components/reports/month-plot";
import { Series } from "@/components/reports/series";
import { MonthlyTotals } from "@/lib/db/models/report.model";
import { formatMoney } from "@/lib/currency/format";
import { niceMax } from "@/lib/reports/chart-scale";

interface TrendChartProps {
  months: MonthlyTotals[];
  baseCurrency: string;
  series: Series[];
}

/**
 * Income against spending, month by month, as grouped columns.
 *
 * Grouped columns on **one** axis — every series is an amount in the same
 * currency, so they share a scale and the comparison is real. A second axis
 * would let the two be slid against each other until they told whatever story
 * was wanted.
 */
const TrendChart = ({ months, baseCurrency, series }: TrendChartProps) => {
  if (months.length === 0) {
    return null;
  }

  const max = niceMax(
    Math.max(...months.flatMap((month) => series.map((entry) => Number(month[entry.key])))),
  );

  const height = (amount: string) => `${Math.max(0, (Number(amount) / max) * 100)}%`;

  return (
    <>
      <MonthPlot
        months={months}
        baseCurrency={baseCurrency}
        domain={{ min: 0, max }}
        legend={series}
        readout={series}
        renderBand={(month) => (
          <div className="absolute inset-0 flex items-end justify-center gap-[2px]">
            {series.map((entry) => (
              <div
                key={entry.key}
                className="w-full max-w-[14px] rounded-t-[4px]"
                style={{ height: height(month[entry.key]), backgroundColor: entry.color }}
              />
            ))}
          </div>
        )}
      />

      <ChartTable
        summary="Show the figures"
        columns={[
          "Month",
          ...series.map((entry) => entry.label),
          ...(series.length > 1 ? ["Net"] : []),
        ]}
        rows={months.map((month) => [
          `${month.label} ${month.month.slice(0, 4)}`,
          ...series.map((entry) => formatMoney(month[entry.key], baseCurrency)),
          ...(series.length > 1 ? [formatMoney(month.net, baseCurrency)] : []),
        ])}
      />
    </>
  );
};

export default TrendChart;
