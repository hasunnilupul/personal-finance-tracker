"use client";

import Link from "next/link";

import ErrorState from "@/components/error-state";
import { Button } from "@/components/ui/button";

/**
 * A dashboard page failed, and the app around it did not.
 *
 * This is the boundary the whole feature exists for. It renders in the layout's
 * padded content area, so the sidebar, the topbar and the mobile navigation are
 * all still on screen and still work — a failed report costs the reader the
 * report, not the application. Without it the error goes up to `app/error.tsx`,
 * which has no shell to render inside and replaces everything.
 *
 * **It cannot catch the layout above it.** `error.tsx` wraps `page.tsx`,
 * `loading.tsx` and nested layouts, but not the `layout.tsx` in its own
 * segment — so a throw from `requireActiveSpace()` in
 * `app/(dashboard)/layout.tsx` bypasses this file entirely and lands in
 * `app/error.tsx`. That is the correct outcome rather than a gap: if the
 * authorization gate is what failed, there is no space resolved and the shell
 * has nothing to show.
 *
 * One boundary for the whole group rather than one per route. A skeleton is
 * worth shaping per page because it is a promise about what is arriving; an
 * error is the opposite — the shape of the page that failed tells the reader
 * nothing they can act on.
 */
const DashboardError = ({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  // Not `reset`. `reset` clears the boundary and re-renders without
  // re-fetching, which cannot recover a Server Component error — and every
  // page under this group fails by way of a query. `unstable_retry` re-runs
  // the fetch, so the button does what the label says.
  unstable_retry: () => void;
}) => {
  return (
    <ErrorState
      boundary="(dashboard)"
      error={error}
      onRetry={unstable_retry}
      title="This page could not be loaded"
      description="Something went wrong while fetching your data. Your records are unaffected — nothing here was being saved."
      className="max-w-xl"
    >
      <Button variant="outline" nativeButton={false} render={<Link href="/" />}>
        Go to the dashboard
      </Button>
    </ErrorState>
  );
};

export default DashboardError;
