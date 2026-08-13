"use client";

import { useState } from "react";

import ChartTable from "@/components/charts/chart-table";
import { MonthlyTotals } from "@/lib/db/models/report.model";
import { formatMoney } from "@/lib/currency/format";
import { cn } from "@/lib/utils";

interface TrendChartProps {
  months: MonthlyTotals[];
  baseCurrency: string;
}

/**
 * A round number at or above the tallest column, for the top gridline.
 *
 * Axis ticks read as measurements, so they round to 1, 2 or 5 times a power of
 * ten rather than to whatever the largest entry happened to be.
 */
function niceMax(value: number): number {
  if (value <= 0) {
    return 1;
  }

  const magnitude = 10 ** Math.floor(Math.log10(value));
  const normalised = value / magnitude;
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10;

  return step * magnitude;
}

const SERIES = [
  { key: "income", label: "Income", color: "var(--viz-income)" },
  { key: "expense", label: "Expenses", color: "var(--viz-expense)" },
] as const;

/**
 * Income against spending, month by month.
 *
 * Grouped columns on **one** axis — both series are amounts in the same
 * currency, so they share a scale and the comparison is real. A second axis
 * would let the two be slid against each other until they told whatever story
 * was wanted.
 *
 * Hover and keyboard focus land on the whole month band rather than on a
 * column, so the reader aims at a month and gets both figures at once. The
 * table underneath carries every value, so nothing is reachable only by
 * pointer.
 */
const TrendChart = ({ months, baseCurrency }: TrendChartProps) => {
  const [active, setActive] = useState<number | null>(null);

  if (months.length === 0) {
    return null;
  }

  const max = niceMax(
    Math.max(...months.flatMap((month) => [Number(month.income), Number(month.expense)])),
  );

  const height = (amount: string) => `${Math.max(0, (Number(amount) / max) * 100)}%`;
  const shown = active !== null ? months[active] : undefined;

  // Twelve "Aug"s fit across a card; twenty-four do not, and a clipped or
  // overlapping tick is worse than no tick. Thin them from the end so the most
  // recent month always keeps its label — it is the one being read.
  const labelEvery = Math.ceil(months.length / 8);
  const isLabelled = (index: number) => (months.length - 1 - index) % labelEvery === 0;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {SERIES.map((series) => (
          <span
            key={series.key}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <span
              aria-hidden
              className="h-2 w-3 shrink-0 rounded-[2px]"
              style={{ backgroundColor: series.color }}
            />
            {series.label}
          </span>
        ))}
      </div>

      <div className="relative mt-3">
        {/* Gridlines, hairline and solid, one step off the surface. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-40">
          {[0, 0.25, 0.5, 0.75, 1].map((step) => (
            <div
              key={step}
              className="border-border absolute inset-x-0 border-t"
              style={{ top: `${step * 100}%` }}
            />
          ))}
        </div>

        <div
          aria-hidden
          className="text-muted-foreground absolute -top-2 right-0 text-[10px] tabular-nums"
        >
          {formatMoney(String(max), baseCurrency, { compact: true })}
        </div>

        <div className="flex h-40 items-stretch">
          {months.map((month, index) => (
            <div
              key={month.month}
              tabIndex={0}
              role="img"
              aria-label={`${month.label} ${month.month.slice(0, 4)}: income ${formatMoney(month.income, baseCurrency)}, expenses ${formatMoney(month.expense, baseCurrency)}`}
              className={cn(
                "focus-visible:ring-ring relative flex flex-1 items-end justify-center gap-[2px] rounded-sm outline-none focus-visible:ring-2",
                active === index && "bg-muted/50",
              )}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              {SERIES.map((series) => (
                <div
                  key={series.key}
                  className="w-full max-w-[14px] rounded-t-[4px]"
                  style={{ height: height(month[series.key]), backgroundColor: series.color }}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-1.5 flex">
          {months.map((month, index) => (
            <p
              key={month.month}
              className="text-muted-foreground flex-1 overflow-hidden text-center text-[10px] whitespace-nowrap"
            >
              {isLabelled(index) ? month.label : ""}
            </p>
          ))}
        </div>

        {shown && (
          <div
            role="status"
            className="border-border bg-popover text-popover-foreground pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2 border px-3 py-2 text-xs shadow-sm"
          >
            <p className="text-muted-foreground mb-1">
              {shown.label} {shown.month.slice(0, 4)}
            </p>

            {SERIES.map((series) => (
              <p key={series.key} className="flex items-center gap-2 whitespace-nowrap">
                <span
                  aria-hidden
                  className="h-0.5 w-3 shrink-0"
                  style={{ backgroundColor: series.color }}
                />
                <span className="text-foreground font-medium tabular-nums">
                  {formatMoney(shown[series.key], baseCurrency)}
                </span>
                <span className="text-muted-foreground">{series.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>

      <ChartTable
        summary="Show the figures"
        columns={["Month", "Income", "Expenses", "Net"]}
        rows={months.map((month) => [
          `${month.label} ${month.month.slice(0, 4)}`,
          formatMoney(month.income, baseCurrency),
          formatMoney(month.expense, baseCurrency),
          formatMoney(month.net, baseCurrency),
        ])}
      />
    </>
  );
};

export default TrendChart;
