import { LoadingRegion } from "@/components/skeletons/skeleton-blocks";
import { EntryRowsSkeleton } from "@/components/skeletons/row-skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TransactionKind } from "@/lib/db/models/transaction.model";

interface TransactionResultsSkeletonProps {
  kind: TransactionKind;
  /** How many rows to reserve. A full page is ten; a first load shows five. */
  rows?: number;
}

/**
 * The part of an expenses or income page that a filter change replaces: the
 * total, and the list under it.
 *
 * The filter bar is deliberately *not* in here. It is the control the reader
 * just used, and blanking it while its own results reload takes away the thing
 * they would reach for next — so it stays on screen and only what it selects
 * goes grey.
 */
const TransactionResultsSkeleton = ({ kind, rows = 6 }: TransactionResultsSkeletonProps) => {
  return (
    <LoadingRegion
      label={`Loading ${kind === "expense" ? "expenses" : "income"}`}
      className="flex flex-col gap-4"
    >
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <Skeleton className="h-4 w-12" />
            <Skeleton className="mt-1.5 h-8 w-40" />
            <Skeleton className="mt-1.5 h-3.5 w-16" />
          </div>

          <Skeleton className="h-9 w-32" />
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <EntryRowsSkeleton rows={rows} />
      </Card>
    </LoadingRegion>
  );
};

export default TransactionResultsSkeleton;
