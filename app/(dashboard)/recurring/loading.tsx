import { LoadingRegion, PageHeaderSkeleton } from "@/components/skeletons/skeleton-blocks";
import { CardRowsSkeleton } from "@/components/skeletons/row-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Recurring templates, waiting.
 *
 * This page is the slowest of the set on purpose: it catches up on every due
 * occurrence before it reads, so a template left alone for a while writes real
 * entries during the render. That is exactly the wait a skeleton is for.
 *
 * No meter on these rows — a template has a schedule and an amount, not a
 * progress bar.
 */
const RecurringLoading = () => {
  return (
    <LoadingRegion label="Loading recurring entries" className="flex flex-col gap-4">
      <PageHeaderSkeleton />

      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-52 max-w-[60%]" />
        <Skeleton className="h-9 w-28" />
      </div>

      <CardRowsSkeleton rows={3} meter={false} />
    </LoadingRegion>
  );
};

export default RecurringLoading;
