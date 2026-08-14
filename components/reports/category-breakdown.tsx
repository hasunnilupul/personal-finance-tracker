import ChartTable from "@/components/charts/chart-table";
import { CategoryTotal } from "@/lib/db/models/report.model";
import { formatMoney } from "@/lib/currency/format";

interface CategoryBreakdownProps {
  rows: CategoryTotal[];
  baseCurrency: string;
  rangeLabel: string;
}

const percent = (share: number) => `${Math.round(share * 100)}%`;

/**
 * Where the money went, largest first.
 *
 * **One series, so one colour.** Shading each bar by its own size would encode
 * length twice and spend the only free channel on something the bar already
 * says; tinting them by the category's own colour would imply the hues mean
 * something. Identity comes from the icon and the name beside each bar.
 *
 * Bars are scaled against the **largest** category rather than the total, so
 * the shape of the ranking is visible even when one category dominates. The
 * share of the total is printed beside each one, so the two readings cannot be
 * confused.
 *
 * Every value is directly labelled, which is what lets this stay a Server
 * Component: there is nothing a tooltip would reveal that is not already on
 * screen. The native `title` carries the same line for a pointer user.
 */
const CategoryBreakdown = ({ rows, baseCurrency, rangeLabel }: CategoryBreakdownProps) => {
  if (rows.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-foreground text-sm font-medium">No spending in {rangeLabel}</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Once expenses are recorded, this shows which categories they fell into.
        </p>
      </div>
    );
  }

  const largest = Math.max(...rows.map((row) => Number(row.total)));

  return (
    <>
      <ul className="mt-4 flex flex-col gap-3">
        {rows.map((row) => {
          const amount = Number(row.total);
          // Against the largest bar, not the total — this is a ranking.
          const width = largest > 0 ? Math.max(1, (amount / largest) * 100) : 0;
          const label = `${row.name}: ${formatMoney(row.total, baseCurrency)}, ${percent(row.share)} of spending`;

          return (
            <li key={`${row.categoryId ?? "none"}-${row.name}`} title={label}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-foreground flex min-w-0 items-center gap-2 text-sm">
                  <span aria-hidden className="shrink-0">
                    {row.icon ?? "•"}
                  </span>
                  <span className="truncate">{row.name}</span>
                </p>

                <p className="text-foreground shrink-0 text-sm font-medium tabular-nums">
                  {formatMoney(row.total, baseCurrency)}
                  <span className="text-muted-foreground ml-2 font-normal">
                    {percent(row.share)}
                  </span>
                </p>
              </div>

              <div className="bg-muted mt-1.5 h-2 w-full overflow-hidden rounded-full">
                <div
                  className="h-full rounded-r-full transition-[width]"
                  style={{ width: `${width}%`, backgroundColor: "var(--viz-expense)" }}
                />
              </div>
            </li>
          );
        })}
      </ul>

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

export default CategoryBreakdown;
