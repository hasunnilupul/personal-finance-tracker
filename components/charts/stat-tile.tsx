import { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface StatTileProps {
  /** Sentence case, no trailing colon. */
  label: string;
  value: string;
  /** A secondary line under the value — what it is measured against. */
  hint?: ReactNode;
  /**
   * A small square of the series colour, tying the tile to the chart below it.
   * A CSS colour, usually a `var(--viz-*)`.
   */
  accent?: string;
  /**
   * Colours the value. Only for figures that genuinely have a good and a bad
   * direction — a net total does, a gross one does not.
   */
  tone?: "neutral" | "positive" | "negative";
}

const TONE: Record<NonNullable<StatTileProps["tone"]>, string> = {
  neutral: "text-foreground",
  positive: "text-emerald-600 dark:text-emerald-500",
  negative: "text-destructive",
};

/**
 * One headline figure.
 *
 * A number is not a chart — a single value with a label reads faster as a tile
 * than as a one-bar bar chart, which is why the month totals and the range
 * summary are these rather than a plot.
 *
 * The value takes the font's default figures rather than `tabular-nums`:
 * equal-width digits are for columns that align vertically, and they make a
 * standalone number look loose at this size.
 */
const StatTile = ({ label, value, hint, accent, tone = "neutral" }: StatTileProps) => {
  return (
    <div className="border-border bg-card flex flex-col gap-1 border p-4">
      <div className="flex items-center gap-2">
        {accent && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: accent }}
          />
        )}
        <p className="text-muted-foreground text-xs">{label}</p>
      </div>

      <p className={cn("text-xl font-semibold tracking-tight", TONE[tone])}>{value}</p>

      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
};

export default StatTile;
