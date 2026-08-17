import { LoadingRegion } from "@/components/skeletons/skeleton-blocks";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Space settings: the base currency card, and the per-device push toggle.
 */
const SpaceSettingsLoading = () => {
  return (
    <LoadingRegion
      label="Loading space settings"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <div>
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-2 h-4 w-64 max-w-full" />
      </div>

      <Card className="p-6">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
        <Skeleton className="mt-4 h-9 w-56 max-w-full" />
      </Card>

      <Card className="p-6">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
        <Skeleton className="mt-4 h-9 w-40" />
      </Card>
    </LoadingRegion>
  );
};

export default SpaceSettingsLoading;
