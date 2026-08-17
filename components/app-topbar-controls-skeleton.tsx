import { Skeleton } from "@/components/ui/skeleton";

/**
 * The topbar controls while they load.
 *
 * Sized to the controls it replaces — a full-width switcher on a phone
 * settling to `w-44` from `sm`, then three buttons — so the header does not
 * change height or push the page down when they arrive. This is the one
 * skeleton that sits above every screen in the app, so a shift here would be
 * a shift on all of them.
 *
 * No `role="status"`: the shell announcing itself on every navigation would
 * interrupt the page the reader actually asked for. The blocks are decorative
 * and the wait is a fraction of a second.
 */
const AppTopbarControlsSkeleton = () => {
  return (
    <div aria-hidden className="flex items-center gap-2">
      <div className="min-w-0 flex-1 sm:w-44 sm:flex-none lg:w-48">
        <Skeleton className="h-9 w-full" />
      </div>

      <Skeleton className="size-9 shrink-0 rounded-full" />
      <Skeleton className="size-9 shrink-0" />
      <Skeleton className="h-8 w-8 shrink-0 sm:w-24" />
    </div>
  );
};

export default AppTopbarControlsSkeleton;
