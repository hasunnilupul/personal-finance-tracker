import { LoadingRegion, SectionCardSkeleton } from "@/components/skeletons/skeleton-blocks";
import { MeterRowsSkeleton } from "@/components/skeletons/row-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The two budget cards, waiting for a month's figures.
 *
 * Each card keeps its own summary line and total meter above the per-category
 * rows, because that is what the real card puts there — a skeleton that dropped
 * them would be shorter than what replaces it and the page would jump.
 */
const BudgetSectionsSkeleton = () => {
  return (
    <LoadingRegion label="Loading budgets" className="flex flex-col gap-4">
      {["monthly", "yearly"].map((period) => (
        <SectionCardSkeleton key={period} action>
          <div className="mt-2 flex flex-col gap-2">
            <Skeleton className="h-3.5 w-56 max-w-full" />
            <Skeleton className="h-2 w-full rounded-full" />
          </div>

          <MeterRowsSkeleton rows={3} className="mt-2" />
        </SectionCardSkeleton>
      ))}
    </LoadingRegion>
  );
};

export default BudgetSectionsSkeleton;
