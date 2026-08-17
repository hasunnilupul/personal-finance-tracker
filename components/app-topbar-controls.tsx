import SpaceSwitcher from "@/components/space-switcher";
import SignOutButton from "@/components/sign-out-button";
import NotificationBell from "@/components/notification-bell";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { listSpaces, requireActiveSpace } from "@/lib/auth/dal";
import { notificationService } from "@/lib/services/notification.service";

/**
 * The right-hand cluster of the topbar: space switcher, bell, theme, sign out.
 *
 * These three queries used to be awaited by the layout, which meant the whole
 * app shell — sidebar, topbar and the page's own loading skeleton — waited on
 * the notification count before anything painted. `loading.tsx` could not help:
 * a route's fallback renders *inside* its layout, so a layout that awaits
 * blocks the fallback too.
 *
 * Fetching here instead puts them behind the topbar's own `<Suspense>`. The
 * shell paints as soon as the space is resolved, which is the auth gate and has
 * to be awaited anyway, and this cluster fills in a moment later.
 *
 * `requireActiveSpace` is memoized per render pass, so asking for it again
 * costs nothing and this component stays responsible for its own scoping.
 */
const AppTopbarControls = async () => {
  const { ctx, space } = await requireActiveSpace();

  const [spaces, notifications, unreadCount] = await Promise.all([
    listSpaces(),
    notificationService.list(ctx),
    notificationService.unreadCount(ctx),
  ]);

  // The wrapper is part of this component rather than the topbar's, so the
  // skeleton can reproduce it exactly. A fallback that is a flex *item* where
  // the content is a flex *container* lays its children out differently, and
  // the swap shows as a jump.
  return (
    <div className="flex items-center gap-2">
      <div className="min-w-0 flex-1 sm:w-44 sm:flex-none lg:w-48">
        <SpaceSwitcher spaces={spaces} activeSpaceId={space.id} />
      </div>

      <NotificationBell notifications={notifications} unreadCount={unreadCount} />
      <ThemeSwitcher />
      <SignOutButton />
    </div>
  );
};

export default AppTopbarControls;
