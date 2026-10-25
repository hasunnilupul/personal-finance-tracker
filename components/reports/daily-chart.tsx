"use client";

import { KeyboardEvent, PointerEvent, useRef, useState } from "react";

import ChartTable from "@/components/charts/chart-table";
import { DailyTotal } from "@/lib/db/models/report.model";
import { formatMoney } from "@/lib/currency/format";
import { niceMax } from "@/lib/reports/chart-scale";
import { dayTicks, summariseDays } from "@/lib/reports/daily";
import { cn } from "@/lib/utils";

interface DailyChartProps {
  days: DailyTotal[];
  baseCurrency: string;
  /** Lower-case, for the empty message: "last 3 months". */
  rangeLabel: string;
}

const FULL_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const SHORT_DATE = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const at = (date: string, format: Intl.DateTimeFormat) =>
  format.format(new Date(`${date}T00:00:00.000Z`));

/** A tooltip centred on its column would hang off the card at either end. */
const clamp = (value: number, low: number, high: number) => Math.min(high, Math.max(low, value));

/**
 * What was spent each day of the range.
 *
 * One series, so one colour and no legend box — the card's heading says what it
 * is. The four figures above the plot say what the columns cannot: the total,
 * what a day cost on average, which day cost the most, and how many cost
 * nothing. Days still to come are left out of all four (see `summariseDays`) and
 * draw no column, so the end of the current month is not mistaken for a run of
 * free days.
 *
 * **There can be 366 columns, so none of them is a control.** A band per day
 * would be a 1.5px hover target and a year of tab stops. Instead the whole plot
 * is the one focusable thing: the pointer picks the nearest day by position, and
 * the arrow keys step through them (Page Up and Down by a week, Home and End to
 * the ends). Touch scrubs the same way, and `touch-pan-y` leaves vertical
 * scrolling to the page. Entering by keyboard lands on the busiest day, which is
 * the one a reader is most likely to be there for.
 *
 * The table under the plot lists the days that had spending, which is what a
 * reader would want from it; the quiet days are counted in the figures above.
 */
const DailyChart = ({ days, baseCurrency, rangeLabel }: DailyChartProps) => {
  const [active, setActive] = useState<number | null>(null);
  const plot = useRef<HTMLDivElement>(null);

  const summary = summariseDays(days);

  if (summary.busiest === null) {
    return (
      <div className="py-8 text-center">
        <p className="text-foreground text-sm font-medium">
          {summary.elapsed === 0
            ? "None of these days has happened yet"
            : `No spending in ${rangeLabel}`}
        </p>
        <p className="text-muted-foreground mt-1 text-sm">
          Once expenses are recorded, this shows what each day came to.
        </p>
      </div>
    );
  }

  const count = days.length;
  const max = niceMax(Math.max(...days.map((day) => Number(day.expense))));
  const ticks = dayTicks(days.map((day) => day.date));
  const shown = active !== null ? days[active] : undefined;

  // A year of columns cannot afford the air between a month's.
  const sparse = count <= 62;

  const indexAt = (clientX: number) => {
    const box = plot.current?.getBoundingClientRect();

    if (!box || box.width === 0) {
      return null;
    }

    return clamp(Math.floor(((clientX - box.left) / box.width) * count), 0, count - 1);
  };

  const onPointer = (event: PointerEvent<HTMLDivElement>) => setActive(indexAt(event.clientX));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowLeft"
          ? -1
          : event.key === "PageDown"
            ? 7
            : event.key === "PageUp"
              ? -7
              : null;

    if (step !== null) {
      event.preventDefault();
      setActive((current) => clamp((current ?? 0) + step, 0, count - 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(count - 1);
    }
  };

  const onFocus = () =>
    setActive((current) =>
      current !== null
        ? current
        : Math.max(
            0,
            days.findIndex((day) => day.date === summary.busiest?.date),
          ),
    );

  return (
    <>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground text-xs">Spent</dt>
          <dd className="text-foreground text-sm font-medium tabular-nums">
            {formatMoney(summary.total, baseCurrency)}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground text-xs">Average a day</dt>
          <dd className="text-foreground text-sm font-medium tabular-nums">
            {summary.average === null ? "—" : formatMoney(summary.average, baseCurrency)}
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground text-xs">Busiest day</dt>
          <dd className="text-foreground text-sm font-medium tabular-nums">
            {formatMoney(summary.busiest.expense, baseCurrency)}
            <span className="text-muted-foreground block text-xs font-normal">
              {at(summary.busiest.date, SHORT_DATE)}
            </span>
          </dd>
        </div>

        <div>
          <dt className="text-muted-foreground text-xs">No-spend days</dt>
          <dd className="text-foreground text-sm font-medium tabular-nums">
            {summary.quietDays}
            <span className="text-muted-foreground block text-xs font-normal">
              of {summary.elapsed} so far
            </span>
          </dd>
        </div>
      </dl>

      <div className="relative mt-5">
        <div
          ref={plot}
          tabIndex={0}
          role="group"
          aria-label={`Daily spending across ${count} days. Use the left and right arrow keys to step through the days.`}
          className="focus-visible:ring-ring relative h-40 touch-pan-y rounded-sm outline-none focus-visible:ring-2"
          onPointerDown={onPointer}
          onPointerMove={onPointer}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onFocus={onFocus}
          onBlur={() => setActive(null)}
        >
          {/* Gridlines, hairline and solid, one step off the surface. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
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
            className="text-muted-foreground pointer-events-none absolute -top-2 right-0 text-[10px] tabular-nums"
          >
            {formatMoney(String(max), baseCurrency, { compact: true })}
          </div>

          {active !== null && (
            <div
              aria-hidden
              className="bg-muted/50 pointer-events-none absolute inset-y-0 rounded-sm"
              style={{ left: `${(active / count) * 100}%`, width: `${100 / count}%` }}
            />
          )}

          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 flex items-end",
              sparse ? "gap-[2px]" : "gap-px",
            )}
          >
            {days.map((day) => {
              const amount = Number(day.expense);

              return (
                <div key={day.date} className="flex h-full min-w-0 flex-1 items-end justify-center">
                  {!day.isFuture && amount > 0 && (
                    <div
                      className={cn(
                        "w-full max-w-[24px]",
                        sparse ? "rounded-t-[4px]" : "rounded-t-[2px]",
                      )}
                      style={{
                        height: `${(amount / max) * 100}%`,
                        // A small day beside a big one would otherwise round to
                        // nothing, and "something was spent" would vanish.
                        minHeight: 2,
                        backgroundColor: "var(--viz-expense)",
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div aria-hidden className="relative mt-1.5 h-3.5">
          {ticks.map((tick) => (
            <p
              key={tick.index}
              className="text-muted-foreground absolute -translate-x-1/2 text-[10px] whitespace-nowrap"
              style={{ left: `${((tick.index + 0.5) / count) * 100}%` }}
            >
              {tick.label}
            </p>
          ))}
        </div>

        {shown && (
          <div
            role="status"
            className="border-border bg-popover text-popover-foreground pointer-events-none absolute top-0 z-10 -translate-x-1/2 border px-3 py-2 text-xs shadow-sm"
            style={{ left: `${clamp((((active ?? 0) + 0.5) / count) * 100, 16, 84)}%` }}
          >
            <p className="text-muted-foreground mb-1 whitespace-nowrap">
              {at(shown.date, FULL_DATE)}
            </p>

            {shown.isFuture ? (
              <p className="text-muted-foreground whitespace-nowrap">Has not happened yet</p>
            ) : (
              <p className="flex items-center gap-2 whitespace-nowrap">
                <span
                  aria-hidden
                  className="h-0.5 w-3 shrink-0"
                  style={{ backgroundColor: "var(--viz-expense)" }}
                />
                <span className="text-foreground font-medium tabular-nums">
                  {formatMoney(shown.expense, baseCurrency)}
                </span>
                <span className="text-muted-foreground">Spent</span>
              </p>
            )}
          </div>
        )}
      </div>

      <ChartTable
        summary="Show the figures"
        columns={["Day", "Spent"]}
        rows={days
          .filter((day) => !day.isFuture && Number(day.expense) > 0)
          .map((day) => [at(day.date, FULL_DATE), formatMoney(day.expense, baseCurrency)])}
      />
    </>
  );
};

export default DailyChart;
