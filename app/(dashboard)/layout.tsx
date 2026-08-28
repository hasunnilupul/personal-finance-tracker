import { ReactNode } from "react";
import AppSidebar from "@/components/app-sidebar";
import AppTopbar from "@/components/app-topbar";
import OfflineBanner from "@/components/offline-banner";
import { requireActiveSpace } from "@/lib/auth/dal";

/**
 * The shell every dashboard page renders inside.
 *
 * It awaits one thing: the active space. That call is the authorization gate,
 * so it has to finish before anything is sent — a `redirect()` after streaming
 * has begun can only be a client-side one.
 *
 * Everything else the topbar shows is fetched below its own `<Suspense>`. A
 * route's `loading.tsx` renders *inside* its layout, so anything this awaited
 * would delay the page's skeleton as well as the page — which is how the app
 * came to sit on a blank screen while a notification count was counted.
 */
const DashboardLayout = async ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => {
  const { space } = await requireActiveSpace();

  return (
    <div className="bg-background flex h-screen w-screen overflow-hidden">
      <AppSidebar isPersonal={space.isPersonal} />

      {/*
        `pb-28` clears the mobile bar, which is fixed and therefore out of the
        flow. It is matched by hand to the bar's height in
        `components/navigation/` — about 5rem now that the bar keeps a strip of
        its own under the icons — so a bar that grows has to move this with it.
      */}
      <main className="w-full flex-1 overflow-auto pb-28 md:pb-0">
        {/*
          Above the topbar and inside the scroller, so it reads as part of the
          page's own header rather than as a floating overlay — and so it
          cannot cover the controls the way a fixed bar would on a phone.
        */}
        <OfflineBanner />

        <AppTopbar space={space} />

        <div className="p-4 sm:p-6">{children}</div>
      </main>
    </div>
  );
};

export default DashboardLayout;
