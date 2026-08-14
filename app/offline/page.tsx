import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * The last resort when the network is gone and the page was never cached.
 *
 * Precached by the service worker at install time, so it has to be static and
 * public: anything read from a session or a database would be exactly what is
 * unavailable when this renders, and a redirect to sign-in is what would get
 * cached under this URL if the proxy guarded it. It is in `publicRoutes` for
 * that reason.
 *
 * Deliberately plain. Everything on it works with no network — the link is a
 * navigation the worker can answer from the page cache when there is a copy.
 */
const OfflinePage = () => {
  return (
    <main className="bg-background flex min-h-svh items-center justify-center px-4">
      <Card className="w-full max-w-sm p-6 text-center">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">You are offline</h1>

        <p className="text-muted-foreground mt-2 text-sm">
          This page has not been opened on this device before, so there is no copy to show. Pages
          you have already visited still work.
        </p>

        <Button className="mt-5 w-full" nativeButton={false} render={<Link href="/" />}>
          Go to the dashboard
        </Button>

        <p className="text-muted-foreground mt-4 text-xs">
          Anything you add while offline will not be saved yet — it needs a connection.
        </p>
      </Card>
    </main>
  );
};

export default OfflinePage;
