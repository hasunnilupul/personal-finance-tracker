import BudgetSectionsSkeleton from "@/components/budgets/budget-sections-skeleton";
import { PageHeaderSkeleton } from "@/components/skeletons/skeleton-blocks";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The budgets page on a first visit.
 *
 * The month arrows are drawn as placeholders here because nothing is on screen
 * to step away from yet. On a later month change they are real and only the
 * cards below them fall back — see the boundary in `budgets/page.tsx`.
 */
const BudgetsLoading = () => {
  return (
    <div className="flex flex-col gap-4">
      <div aria-hidden className="flex flex-col gap-4">
        <PageHeaderSkeleton />

        <div className="flex items-center gap-1">
          <Skeleton className="size-8" />
          <Skeleton className="size-8" />
          <Skeleton className="ml-2 h-4 w-28" />
        </div>
      </div>

      <BudgetSectionsSkeleton />
    </div>
  );
};

export default BudgetsLoading;
