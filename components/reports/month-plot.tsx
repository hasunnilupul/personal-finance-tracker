"use client";

import { ReactNode, useState } from "react";

import { MonthlyTotals } from "@/lib/db/models/report.model";
import { Domain, percentFromTop } from "@/lib/reports/chart-scale";
import { formatMoney } from "@/lib/currency/format";
import { cn } from "@/lib/utils";

import { Series } from "./series";

interface LegendEntry {
  label: string;
  color: string;
  /** What the mark is: a block for columns, a stroke for a line. */
  shape?: "block" | "line";
}

interface MonthPlotProps {
  months: MonthlyTotals[];
  baseCurrency: string;
  domain: Domain;
  legend: LegendEntry[];
  /** What the tooltip and each month's accessible name list, in order. */
  readout: Series[];
  /** The marks that belong to one month, drawn inside its band. */
  renderBand?: (month: MonthlyTotals, index: number) => ReactNode;
  /** Marks that run across months, drawn over the bands. */
  overlay?: (active: number | null) => ReactNode;
}

/**
 * The frame every month-by-month chart here is drawn in: legend, gridlines,
 * one band per month, the month labels and a tooltip.
 *
 * Hover and keyboard focus land on the whole month band rather than on a mark,
 * so the reader aims at a month and gets every figure at once — the same
 * target whether the marks are columns, a line or a bar off a zero baseline.
 * The tooltip is a convenience: each chart ships a table twin, so nothing is
 * reachable only by pointer.
 *
 * The domain always contains zero. When it also goes below it, the zero line is
 * drawn heavier than the other gridlines and the lower bound is labelled too.
 */
const MonthPlot = ({
  months,
  baseCurrency,
  domain,
  legend,
  readout,
  renderBand,
  overlay,
}: MonthPlotProps) => {
  const [active, setActive] = useState<number | null>(null);

  const shown = active !== null ? months[active] : undefined;
  const hasNegative = domain.min < 0;
  const zeroAt = percentFromTop(0, domain);

  // Twelve "Aug"s fit across a card; twenty-four do not, and a clipped or
  // overlapping tick is worse than no tick. Thin them from the end so the most
  // recent month always keeps its label — it is the one being read.
  const labelEvery = Math.ceil(months.length / 8);
  const isLabelled = (index: number) => (months.length - 1 - index) % labelEvery === 0;

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
        {legend.map((entry) => (
          <span
            key={entry.label}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <span
              aria-hidden
              className={cn(
                "shrink-0",
                entry.shape === "line" ? "h-0.5 w-3 rounded-full" : "h-2 w-3 rounded-[2px]",
              )}
              style={{ backgroundColor: entry.color }}
            />
            {entry.label}
          </span>
        ))}
      </div>

      <div className="relative mt-3">
        <div className="relative h-40">
          {/* Gridlines, hairline and solid, one step off the surface. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            {[0, 0.25, 0.5, 0.75, 1].map((step) => (
              <div
                key={step}
                className="border-border absolute inset-x-0 border-t"
                style={{ top: `${step * 100}%` }}
              />
            ))}

            {hasNegative && zeroAt > 0 && zeroAt < 100 && (
              <div
                className="border-muted-foreground/60 absolute inset-x-0 border-t"
                style={{ top: `${zeroAt}%` }}
              />
            )}
          </div>

          <div
            aria-hidden
            className="text-muted-foreground absolute -top-2 right-0 text-[10px] tabular-nums"
          >
            {formatMoney(String(domain.max), baseCurrency, { compact: true })}
          </div>

          {hasNegative && (
            <div
              aria-hidden
              className="text-muted-foreground bg-card/80 absolute right-0 bottom-0.5 px-0.5 text-[10px] tabular-nums"
            >
              {formatMoney(String(domain.min), baseCurrency, { compact: true })}
            </div>
          )}

          <div className="absolute inset-0 flex items-stretch">
            {months.map((month, index) => (
              <div
                key={month.month}
                tabIndex={0}
                role="img"
                aria-label={`${month.label} ${month.month.slice(0, 4)}: ${readout
                  .map(
                    (row) =>
                      `${row.label.toLowerCase()} ${formatMoney(month[row.key], baseCurrency)}`,
                  )
                  .join(", ")}`}
                className={cn(
                  "focus-visible:ring-ring relative flex-1 rounded-sm outline-none focus-visible:ring-2",
                  active === index && "bg-muted/50",
                )}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              >
                {renderBand?.(month, index)}
              </div>
            ))}
          </div>

          {overlay && (
            <div aria-hidden className="pointer-events-none absolute inset-0">
              {overlay(active)}
            </div>
          )}
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

            {readout.map((row) => (
              <p key={row.key} className="flex items-center gap-2 whitespace-nowrap">
                <span
                  aria-hidden
                  className="h-0.5 w-3 shrink-0"
                  style={{ backgroundColor: row.color }}
                />
                <span className="text-foreground font-medium tabular-nums">
                  {formatMoney(shown[row.key], baseCurrency)}
                </span>
                <span className="text-muted-foreground">{row.label}</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default MonthPlot;
