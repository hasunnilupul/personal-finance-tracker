"use client";

import ChartTable from "@/components/charts/chart-table";
import MonthPlot from "@/components/reports/month-plot";
import { Series } from "@/components/reports/series";
import { MonthlyTotals } from "@/lib/db/models/report.model";
import { formatMoney } from "@/lib/currency/format";
import { niceMax, percentFromTop } from "@/lib/reports/chart-scale";

interface TrendLinesProps {
  months: MonthlyTotals[];
  baseCurrency: string;
  series: Series[];
}

/**
 * The same months as the columns, read as direction rather than size.
 *
 * Columns answer "how much, this month"; a line answers "which way is it
 * going", and with a handful of months the second is hard to see across
 * separate groups. Same single axis, same domain rule — zero at the floor — so
 * the two views cannot disagree about scale.
 *
 * The lines are an SVG stretched to the plot (`preserveAspectRatio="none"`)
 * with a non-scaling stroke, so they stay 2px at any width. Dots are HTML laid
 * over it by percentage instead, because a circle in a stretched SVG becomes an
 * ellipse. Only the latest month and the one being read get a dot — a marker on
 * every point is clutter, and the band hover reaches the rest.
 *
 * A single series gets a faint wash beneath it; several would pile up into mud.
 */
const TrendLines = ({ months, baseCurrency, series }: TrendLinesProps) => {
  if (months.length === 0) {
    return null;
  }

  const domain = {
    min: 0,
    max: niceMax(
      Math.max(...months.flatMap((month) => series.map((entry) => Number(month[entry.key])))),
    ),
  };

  // A point sits in the middle of its month's band, which is where the hover
  // target for it is.
  const xOf = (index: number) => ((index + 0.5) / months.length) * 100;
  const yOf = (month: MonthlyTotals, entry: Series) =>
    percentFromTop(Number(month[entry.key]), domain);

  const pointsFor = (entry: Series) =>
    months.map((month, index) => `${xOf(index)},${yOf(month, entry)}`).join(" ");

  return (
    <>
      <MonthPlot
        months={months}
        baseCurrency={baseCurrency}
        domain={domain}
        legend={series.map((entry) => ({ ...entry, shape: "line" as const }))}
        readout={series}
        overlay={(active) => {
          const dotted = new Set([months.length - 1, ...(active !== null ? [active] : [])]);

          return (
            <>
              <svg
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                className="absolute inset-0 h-full w-full overflow-visible"
              >
                {series.length === 1 && months.length > 1 && (
                  <polygon
                    points={`${xOf(0)},100 ${pointsFor(series[0])} ${xOf(months.length - 1)},100`}
                    fill={series[0].color}
                    fillOpacity={0.1}
                  />
                )}

                {series.map((entry) => (
                  <polyline
                    key={entry.key}
                    points={pointsFor(entry)}
                    fill="none"
                    stroke={entry.color}
                    strokeWidth={2}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                ))}
              </svg>

              {[...dotted].flatMap((index) =>
                series.map((entry) => (
                  <span
                    key={`${index}-${entry.key}`}
                    className="ring-card absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2"
                    style={{
                      left: `${xOf(index)}%`,
                      top: `${yOf(months[index], entry)}%`,
                      backgroundColor: entry.color,
                    }}
                  />
                )),
              )}
            </>
          );
        }}
      />

      <ChartTable
        summary="Show the figures"
        columns={["Month", ...series.map((entry) => entry.label)]}
        rows={months.map((month) => [
          `${month.label} ${month.month.slice(0, 4)}`,
          ...series.map((entry) => formatMoney(month[entry.key], baseCurrency)),
        ])}
      />
    </>
  );
};

export default TrendLines;
