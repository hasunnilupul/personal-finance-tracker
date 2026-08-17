import { LoadingRegion } from "@/components/skeletons/skeleton-blocks";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The create-space form.
 *
 * This page waits on a session read rather than on a query, so the wait is
 * usually too short to see. It still needs its own file: without one the route
 * falls back to the dashboard's `loading.tsx` one level up, and a form would be
 * announced by a skeleton of totals and budget bars.
 */
const NewSpaceLoading = () => {
  return (
    <LoadingRegion label="Loading the new space form" className="mx-auto w-full max-w-lg">
      <Card className="p-6">
        <div>
          <Skeleton className="h-8 w-56 max-w-full" />
          <Skeleton className="mt-2 h-4 w-full max-w-sm" />
        </div>

        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>

        <Skeleton className="h-9 w-32" />
      </Card>
    </LoadingRegion>
  );
};

export default NewSpaceLoading;
