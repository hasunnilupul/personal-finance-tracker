import {
  LoadingRegion,
  PageHeaderSkeleton,
  StatTilesSkeleton,
} from "@/components/skeletons/skeleton-blocks";
import { EntryRowsSkeleton, MeterRowsSkeleton } from "@/components/skeletons/row-skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The dashboard while this month is being totalled.
 *
 * This file is the fallback for the dashboard alone — every other route under
 * `(dashboard)` has its own `loading.tsx` that mirrors its own layout. A single
 * shared fallback would show the wrong shape on nine screens out of ten, which
 * is worse than a spinner: it promises a page that is not the one arriving.
 *
 * Nothing here is centred or full-height. It renders inside the layout's
 * padded content area, with the sidebar and topbar already on screen around it.
 */
const DashboardLoading = () => {
  return (
    <LoadingRegion label="Loading your dashboard" className="flex flex-col gap-4">
      <PageHeaderSkeleton />

      <StatTilesSkeleton count={3} className="sm:grid-cols-3" />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-3.5 w-20" />
          </div>

          <EntryRowsSkeleton rows={5} className="mt-2" />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <Skeleton className="h-6 w-32" />
          </div>

          <Skeleton className="mt-1.5 h-3.5 w-56 max-w-full" />

          <MeterRowsSkeleton rows={4} className="mt-3" />
        </Card>
      </div>
    </LoadingRegion>
  );
};

export default DashboardLoading;
