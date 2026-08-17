import {
  LoadingRegion,
  PageHeaderSkeleton,
  SectionCardSkeleton,
} from "@/components/skeletons/skeleton-blocks";
import { DividedRowsSkeleton } from "@/components/skeletons/row-skeletons";

/**
 * Both category lists, waiting for their usage counts.
 *
 * Two cards, because the page is always two: expense categories and income
 * ones, each with its own add button.
 */
const CategoriesLoading = () => {
  return (
    <LoadingRegion label="Loading categories" className="flex flex-col gap-4">
      <PageHeaderSkeleton />

      {["expense", "income"].map((type) => (
        <SectionCardSkeleton key={type} action>
          <DividedRowsSkeleton rows={4} className="mt-2" />
        </SectionCardSkeleton>
      ))}
    </LoadingRegion>
  );
};

export default CategoriesLoading;
