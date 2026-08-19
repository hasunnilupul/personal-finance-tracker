"use client";

import Link from "next/link";

import ErrorState from "@/components/error-state";
import { Button } from "@/components/ui/button";

/**
 * The net under everything that is not a dashboard page.
 *
 * Three quite different failures land here, and they have one thing in common —
 * there is no shell left to render inside:
 *
 * - **`app/(dashboard)/layout.tsx` itself throwing**, which the group's own
 *   boundary cannot catch because `error.tsx` never wraps the layout in its own
 *   segment. In practice that means `requireActiveSpace()` — the authorization
 *   gate — so there is no resolved space and nothing to draw a sidebar from.
 * - **`/accept-invitation/[id]`** and the auth pages, which have no layout of
 *   their own and so nothing worth preserving around the message.
 * - Anything thrown by the root layout's own children before a group is
 *   entered.
 *
 * So this one is full-height and centred, matching `/offline` — the app's other
 * standalone "this did not work" page. Same furniture, because they are the
 * same situation to the reader.
 *
 * It does **not** catch the root layout. That is `global-error.tsx`.
 */
const AppError = ({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) => {
  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-4 py-10">
      <ErrorState
        boundary="app"
        error={error}
        onRetry={unstable_retry}
        title="Something went wrong"
        description="The page could not be loaded. Trying again will re-fetch it; if it keeps failing, signing in again is the next thing to try."
        className="max-w-md"
      >
        <Button variant="outline" nativeButton={false} render={<Link href="/sign-in" />}>
          Go to sign in
        </Button>
      </ErrorState>
    </main>
  );
};

export default AppError;
