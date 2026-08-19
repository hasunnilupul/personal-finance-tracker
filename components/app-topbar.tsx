import { Suspense } from "react";

import AppTopbarControls from "@/components/app-topbar-controls";
import BrandMark from "@/components/brand-mark";
import AppTopbarControlsSkeleton from "@/components/app-topbar-controls-skeleton";
import { Organization } from "@/lib/db/models/organization.model";

interface AppTopbarProps {
  space: Organization;
}

/**
 * The bar above every dashboard page: which ledger is open, and the controls
 * that act on the session rather than on the data.
 *
 * The identity comes from the space the layout already resolved — that call is
 * the auth gate, so it is awaited before anything renders. The controls fetch
 * their own three lists behind a `<Suspense>`, so the shell no longer waits on
 * a notification count to paint.
 *
 * It reflows rather than shrinks. Below `sm` the identity and the controls are
 * two stacked rows, which is what keeps a long space name readable on a phone
 * instead of squeezing it against a switcher; from `sm` up there is width for
 * both on one line. The switcher fills its row on a phone and settles at a
 * fixed width once it shares the line.
 *
 * **It also carries the brand, but only on a phone.** The sidebar owns that on
 * desktop, and the sidebar is `md:hidden` — so below `md` there was nowhere the
 * app said its own name. The bottom bar is not the answer: it is tab
 * navigation, and a logo in it would cost one of five tab slots. A row here is
 * `md:hidden`, sits inside the header's existing padding, and so adds nothing
 * to a desktop viewport at all.
 */
const AppTopbar = ({ space }: AppTopbarProps) => {
  return (
    <header className="border-border bg-card border-b p-4 sm:p-6">
      {/*
        `decorative`, because the wordmark beside it is the accessible name.
        Its own `gradientId`, because the splash is in the root layout and two
        marks share every page — see `components/brand-mark.tsx`.
      */}
      <div className="mb-3 flex items-center gap-2 md:hidden">
        <BrandMark className="size-5 shrink-0" gradientId="ff-topbar-mark-gradient" decorative />

        <span className="text-muted-foreground text-xs font-medium tracking-[0.14em] uppercase">
          FinanceFlow
        </span>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0 sm:flex-1">
          <h1 className="text-foreground truncate text-xl font-bold sm:text-2xl lg:text-3xl">
            {space.isPersonal ? "Your money" : space.name}
          </h1>
          <p className="text-muted-foreground mt-1 text-xs sm:text-sm">
            {space.isPersonal
              ? "Private to you — nobody else can see this ledger"
              : "Shared space — everyone here can add and edit entries"}
          </p>
        </div>

        <Suspense fallback={<AppTopbarControlsSkeleton />}>
          <AppTopbarControls />
        </Suspense>
      </div>
    </header>
  );
};

export default AppTopbar;
