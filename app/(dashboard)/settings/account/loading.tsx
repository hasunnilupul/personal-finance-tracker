import { LoadingRegion } from "@/components/skeletons/skeleton-blocks";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Account settings: the sub-navigation, then the password card.
 */
const AccountSettingsLoading = () => {
  return (
    <LoadingRegion
      label="Loading account settings"
      className="mx-auto flex w-full max-w-2xl flex-col gap-6"
    >
      <div>
        <Skeleton className="h-8 w-56" />
        <Skeleton className="mt-2 h-4 w-72 max-w-full" />
      </div>

      <div className="flex gap-2">
        <Skeleton className="h-8 w-20" />
        <Skeleton className="h-8 w-24" />
      </div>

      <Card className="p-6">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
        <Skeleton className="mt-4 h-9 w-full" />
        <Skeleton className="mt-4 h-9 w-full" />
        <Skeleton className="mt-4 h-9 w-full" />
        <Skeleton className="mt-4 h-9 w-40" />
      </Card>

      <Card className="p-6">
        <Skeleton className="h-5 w-44" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
        <Skeleton className="mt-4 h-9 w-28" />
      </Card>
    </LoadingRegion>
  );
};

export default AccountSettingsLoading;
