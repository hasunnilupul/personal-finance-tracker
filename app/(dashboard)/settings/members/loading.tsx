import { LoadingRegion } from "@/components/skeletons/skeleton-blocks";
import { DividedRowsSkeleton } from "@/components/skeletons/row-skeletons";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The members screen while the space's people and pending invitations load.
 *
 * Narrow column and `p-6` cards, matching the real page — this one is a
 * settings form rather than a dashboard grid, and a full-width skeleton would
 * reflow the moment it resolved.
 *
 * Two cards, which is the fewest anyone sees: an owner gets the invite form
 * above the member list, a member gets the list and a leave card. The third —
 * pending invitations — only exists when there are some, so drawing it here
 * would leave a hole on most visits.
 */
const MembersLoading = () => {
  return (
    <LoadingRegion label="Loading members" className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-4 w-full max-w-md" />
      </div>

      <Card className="p-6">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="mt-2 h-4 w-full max-w-sm" />
        <Skeleton className="mt-4 h-9 w-full" />
      </Card>

      <Card className="p-6">
        <Skeleton className="h-5 w-32" />
        <DividedRowsSkeleton rows={3} className="mt-4" />
      </Card>
    </LoadingRegion>
  );
};

export default MembersLoading;
