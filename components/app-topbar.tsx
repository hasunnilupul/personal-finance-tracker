import SpaceSwitcher from "@/components/space-switcher";
import SignOutButton from "@/components/sign-out-button";
import NotificationBell from "@/components/notification-bell";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Organization, Space } from "@/lib/db/models/organization.model";
import { Notification } from "@/lib/db/models/notification.model";

interface AppTopbarProps {
  space: Organization;
  spaces: Space[];
  notifications: Notification[];
  unreadCount: number;
}

/**
 * The bar above every dashboard page: which ledger is open, and the controls
 * that act on the session rather than on the data.
 *
 * A presentational Server Component — the layout does the fetching, so this
 * takes what it needs as props and adds no round trip of its own.
 *
 * It reflows rather than shrinks. Below `sm` the identity and the controls are
 * two stacked rows, which is what keeps a long space name readable on a phone
 * instead of squeezing it against a switcher; from `sm` up there is width for
 * both on one line. The switcher fills its row on a phone and settles at a
 * fixed width once it shares the line.
 */
const AppTopbar = ({ space, spaces, notifications, unreadCount }: AppTopbarProps) => {
  return (
    <header className="border-border bg-card border-b p-4 sm:p-6">
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

        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 sm:w-44 sm:flex-none lg:w-48">
            <SpaceSwitcher spaces={spaces} activeSpaceId={space.id} />
          </div>
          <NotificationBell notifications={notifications} unreadCount={unreadCount} />
          <ThemeSwitcher />
          <SignOutButton />
        </div>
      </div>
    </header>
  );
};

export default AppTopbar;
