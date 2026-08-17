import { LoadingRegion } from "@/components/skeletons/skeleton-blocks";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * An invitation link, while the invitation is looked up.
 *
 * This is the first thing an invited person ever sees of the app, and it is
 * reached from an email or a pasted link, so it is always a cold load. The card
 * is the same centred `max-w-md` shell every outcome of this page renders —
 * whichever answer comes back, only the words inside it change.
 */
const AcceptInvitationLoading = () => {
  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-4">
      <LoadingRegion label="Loading this invitation" className="w-full max-w-md">
        <Card className="p-6">
          <Skeleton className="h-7 w-full max-w-xs" />
          <Skeleton className="mt-3 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-3/4" />

          <div className="mt-6 flex flex-col gap-2">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        </Card>
      </LoadingRegion>
    </main>
  );
};

export default AcceptInvitationLoading;
