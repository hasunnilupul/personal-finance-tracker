import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * The repeating rows inside a card, one shape per list in the app.
 *
 * Widths vary down a list because a column of identical bars reads as a table
 * rather than as text waiting to arrive. They cycle through a fixed pattern
 * rather than being random: a fallback that renders differently on the server
 * and the client is a hydration mismatch, and one that changes between visits
 * looks like data.
 */
const TITLE_WIDTHS = ["w-40", "w-32", "w-48", "w-36", "w-44"];
const DETAIL_WIDTHS = ["w-28", "w-36", "w-24", "w-32", "w-28"];

const cycle = (widths: string[], index: number) => widths[index % widths.length];

interface RowsProps {
  rows: number;
  className?: string;
}

/**
 * A ledger row: category chip, description over date, amount on the right.
 *
 * Shared by the transaction lists and the dashboard's recent activity, which
 * are the same row seen from two distances — so their loading states are the
 * same row too.
 */
export const EntryRowsSkeleton = ({ rows, className }: RowsProps) => {
  return (
    <div className={cn("divide-border divide-y", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-start justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <Skeleton className="mt-0.5 size-8 shrink-0 rounded-full" />

            <div className="min-w-0">
              <Skeleton className={cn("h-4", cycle(TITLE_WIDTHS, index))} />
              <Skeleton className={cn("mt-1.5 h-3", cycle(DETAIL_WIDTHS, index))} />
            </div>
          </div>

          <Skeleton className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
};

/**
 * A label, a figure and the bar underneath: budget health, and the reports
 * breakdown, which draw the same row with different numbers in it.
 *
 * The track keeps `rounded-full`, which the meters set explicitly rather than
 * taking from `--radius` — so the placeholder has to as well, or the bar
 * changes shape as it fills in.
 */
export const MeterRowsSkeleton = ({ rows, className }: RowsProps) => {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index}>
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className={cn("h-4", cycle(TITLE_WIDTHS, index))} />
            <Skeleton className="h-3.5 w-24 shrink-0" />
          </div>

          <Skeleton className="mt-1.5 h-2 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
};

interface CardRowsSkeletonProps extends RowsProps {
  /** Goals and recurring templates both carry a progress meter or a schedule line. */
  meter?: boolean;
}

/**
 * A list where every row is its own card: savings goals, recurring templates.
 */
export const CardRowsSkeleton = ({ rows, meter = true, className }: CardRowsSkeletonProps) => {
  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <Card key={index} className="p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3">
              <Skeleton className="size-8 shrink-0 rounded-full" />

              <div className="min-w-0">
                <Skeleton className={cn("h-4", cycle(TITLE_WIDTHS, index))} />
                <Skeleton className={cn("mt-1.5 h-3", cycle(DETAIL_WIDTHS, index))} />
              </div>
            </div>

            <div className="flex shrink-0 gap-1">
              <Skeleton className="size-8" />
              <Skeleton className="size-8" />
            </div>
          </div>

          {meter && <Skeleton className="mt-3 h-2 w-full rounded-full" />}
        </Card>
      ))}
    </div>
  );
};

/**
 * Plain rows separated by a rule: members, pending invitations, categories.
 */
export const DividedRowsSkeleton = ({ rows, className }: RowsProps) => {
  return (
    <div className={cn("flex flex-col divide-y", className)}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center justify-between gap-4 py-3">
          <div className="min-w-0">
            <Skeleton className={cn("h-4", cycle(TITLE_WIDTHS, index))} />
            <Skeleton className={cn("mt-1.5 h-3", cycle(DETAIL_WIDTHS, index))} />
          </div>

          <Skeleton className="h-8 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
};
