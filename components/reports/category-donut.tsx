"use client";

import { useState } from "react";

import ChartTable from "@/components/charts/chart-table";
import { CategoryTotal } from "@/lib/db/models/report.model";
import { formatMoney } from "@/lib/currency/format";
import { foldCategories, ringArcs } from "@/lib/reports/chart-scale";
import { cn } from "@/lib/utils";

interface CategoryDonutProps {
  rows: CategoryTotal[];
  baseCurrency: string;
}

/** Five hues in a fixed order, then the neutral. See `--viz-cat-*` in globals.css. */
const WEDGE_COLORS = [
  "var(--viz-cat-1)",
  "var(--viz-cat-2)",
  "var(--viz-cat-3)",
  "var(--viz-cat-4)",
  "var(--viz-cat-5)",
  "var(--viz-other)",
];

const RADIUS = 38;
const STROKE = 14;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Surface between wedges, in the SVG's own units (the ring is 100 across).
const GAP = 1.5;

const percent = (share: number) =>
  share > 0 && share < 0.005 ? "<1%" : `${Math.round(share * 100)}%`;

/**
 * The same spending as the bars, read as a share of the whole.
 *
 * Bars say which category is biggest; a ring says how much of the total it is,
 * which is the question a budget conversation actually opens with. It is the
 * second view, not the first, because at a glance a wedge's angle is read less
 * accurately than a bar's length — hence the percentage printed beside every
 * name rather than left for the reader to estimate.
 *
 * **At most six wedges.** Five hues and a neutral; any longer tail is summed
 * into "Other". Colour is assigned by rank, so a category can change hue when
 * the range does — which is why identity never rests on colour here: every
 * wedge's name, icon, amount and share are printed in the list beside it, and
 * the list is what hover and keyboard focus move through. Two of the five hues
 * measure under 3:1 on the light card, and that printed text is the relief.
 */
const CategoryDonut = ({ rows, baseCurrency }: CategoryDonutProps) => {
  const [active, setActive] = useState<number | null>(null);

  // The empty case is the bars' to explain, and the report body offers no
  // second view when there is nothing to draw.
  if (rows.length === 0) {
    return null;
  }

  const slices = foldCategories(rows, WEDGE_COLORS.length);
  const arcs = ringArcs(
    slices.map((slice) => Number(slice.total)),
    CIRCUMFERENCE,
    GAP,
  );
  const total = rows.reduce((sum, row) => sum + Number(row.total), 0);
  const shown = active !== null ? slices[active] : undefined;

  const summary = slices.map((slice) => `${slice.name} ${percent(slice.share)}`).join(", ");

  return (
    <>
      <div className="mt-4 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <div
          role="img"
          aria-label={`Spending by category: ${summary}`}
          className="relative size-44 shrink-0"
        >
          <svg viewBox="0 0 100 100" className="size-full -rotate-90" aria-hidden>
            {/* The track, so a thin ring still reads as one object. */}
            <circle
              cx={50}
              cy={50}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-muted"
            />

            {slices.map((slice, index) => (
              <circle
                key={slice.key}
                cx={50}
                cy={50}
                r={RADIUS}
                fill="none"
                stroke={WEDGE_COLORS[index]}
                strokeWidth={active === index ? STROKE + 2 : STROKE}
                strokeDasharray={`${arcs[index].length} ${CIRCUMFERENCE}`}
                strokeDashoffset={-arcs[index].start}
                opacity={active === null || active === index ? 1 : 0.45}
                className="transition-[opacity,stroke-width]"
              />
            ))}
          </svg>

          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-9 text-center">
            <p className="text-muted-foreground max-w-full truncate text-[11px]">
              {shown ? shown.name : "Spent"}
            </p>
            <p className="text-foreground text-base leading-tight font-semibold tabular-nums">
              {formatMoney(shown ? shown.total : String(total), baseCurrency, { compact: true })}
            </p>
            {shown && <p className="text-muted-foreground text-[11px]">{percent(shown.share)}</p>}
          </div>
        </div>

        <ul className="flex w-full min-w-0 flex-1 flex-col gap-0.5">
          {slices.map((slice, index) => (
            <li
              key={slice.key}
              tabIndex={0}
              className={cn(
                "focus-visible:ring-ring flex items-center justify-between gap-3 rounded-sm px-2 py-1.5 outline-none focus-visible:ring-2",
                active === index && "bg-muted/50",
              )}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              <p className="text-foreground flex min-w-0 items-center gap-2 text-sm">
                <span
                  aria-hidden
                  className="h-2 w-3 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: WEDGE_COLORS[index] }}
                />
                <span aria-hidden className="shrink-0">
                  {slice.icon ?? (slice.key === "other" ? "…" : "•")}
                </span>
                <span className="truncate">{slice.name}</span>
                {slice.count > 1 && (
                  <span className="text-muted-foreground shrink-0 text-xs">
                    {slice.count} categories
                  </span>
                )}
              </p>

              <p className="text-foreground shrink-0 text-sm font-medium tabular-nums">
                {formatMoney(slice.total, baseCurrency)}
                <span className="text-muted-foreground ml-2 inline-block w-9 text-right font-normal">
                  {percent(slice.share)}
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>

      <ChartTable
        summary="Show the figures"
        columns={["Category", "Spent", "Share"]}
        rows={rows.map((row) => [
          row.name,
          formatMoney(row.total, baseCurrency),
          percent(row.share),
        ])}
      />
    </>
  );
};

export default CategoryDonut;
