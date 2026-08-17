import { LoadingRegion, PageHeaderSkeleton } from "@/components/skeletons/skeleton-blocks";
import { CardRowsSkeleton } from "@/components/skeletons/row-skeletons";
import { Skeleton } from "@/components/ui/skeleton";

const GoalsLoading = () => {
  return (
    <LoadingRegion label="Loading savings goals" className="flex flex-col gap-4">
      <PageHeaderSkeleton />

      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-52 max-w-[60%]" />
        <Skeleton className="h-9 w-28" />
      </div>

      <CardRowsSkeleton rows={3} />
    </LoadingRegion>
  );
};

export default GoalsLoading;
