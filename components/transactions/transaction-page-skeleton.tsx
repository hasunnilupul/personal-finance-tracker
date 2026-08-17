import { ControlBarSkeleton } from "@/components/skeletons/skeleton-blocks";
import TransactionResultsSkeleton from "@/components/transactions/transaction-results-skeleton";
import { TransactionKind } from "@/lib/db/models/transaction.model";

interface TransactionPageSkeletonProps {
  kind: TransactionKind;
}

/**
 * A whole expenses or income page, on the first visit.
 *
 * The filter bar is a placeholder here and only here: on a first load there is
 * nothing to filter yet, so there is no control to preserve. Once the page has
 * rendered, a filter change swaps only {@link TransactionResultsSkeleton} in
 * and the real bar stays put.
 *
 * The bar is `aria-hidden` and the results skeleton carries the one
 * `role="status"` for the page. Two live regions announcing the same wait is
 * one announcement too many.
 */
const TransactionPageSkeleton = ({ kind }: TransactionPageSkeletonProps) => {
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden>
        <ControlBarSkeleton fields={3} />
      </div>

      <TransactionResultsSkeleton kind={kind} />
    </div>
  );
};

export default TransactionPageSkeleton;
