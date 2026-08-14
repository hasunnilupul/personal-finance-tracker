"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { BellIcon, PiggyBankIcon, RepeatIcon, UsersIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/actions/notification.actions";
import { Notification, NotificationType } from "@/lib/db/models/notification.model";
import { cn } from "@/lib/utils";

interface NotificationBellProps {
  notifications: Notification[];
  unreadCount: number;
}

const ICONS: Record<NotificationType, typeof BellIcon> = {
  budget_overspend: PiggyBankIcon,
  recurring_created: RepeatIcon,
  space_invitation: UsersIcon,
};

/**
 * How long ago, in the roughest terms that are still true.
 *
 * `Intl.RelativeTimeFormat` rather than a date library — three thresholds do
 * not pay for a dependency, the same call the charts made.
 */
const RELATIVE = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

function timeAgo(from: Date): string {
  const seconds = Math.round((from.getTime() - Date.now()) / 1000);
  const minutes = Math.round(seconds / 60);
  const hours = Math.round(minutes / 60);
  const days = Math.round(hours / 24);

  if (Math.abs(seconds) < 60) return RELATIVE.format(seconds, "second");
  if (Math.abs(minutes) < 60) return RELATIVE.format(minutes, "minute");
  if (Math.abs(hours) < 24) return RELATIVE.format(hours, "hour");

  return RELATIVE.format(days, "day");
}

/**
 * What the app has noticed, and how much of it is new.
 *
 * The list is rendered on the server and passed in, so opening the menu costs
 * nothing — this only sends a write when something is actually marked read.
 */
const NotificationBell = ({ notifications, unreadCount }: NotificationBellProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const open = (notification: Notification) => {
    startTransition(async () => {
      if (!notification.readAt) {
        await markNotificationReadAction(notification.id);
      }

      if (notification.href) {
        router.push(notification.href);
      } else {
        router.refresh();
      }
    });
  };

  const markAll = () => {
    startTransition(async () => {
      await markAllNotificationsReadAction();
      router.refresh();
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={
          unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications, none unread"
        }
        className="text-muted-foreground hover:text-foreground hover:bg-muted relative inline-flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
      >
        <BellIcon className="size-5" />
        {unreadCount > 0 && (
          // A dot, not a number: past "some", the count is noise, and a badge
          // that reads "17" is a chore rather than a signal.
          <span className="bg-primary absolute top-1.5 right-1.5 size-2 rounded-full" />
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="border-border flex items-center justify-between border-b px-3 py-2">
          <p className="text-foreground text-sm font-medium">Notifications</p>
          {unreadCount > 0 && (
            <Button variant="ghost" size="xs" onClick={markAll} disabled={isPending}>
              Mark all read
            </Button>
          )}
        </div>

        {notifications.length === 0 ? (
          <p className="text-muted-foreground px-3 py-6 text-center text-sm">
            Nothing yet. Budget overspends and recurring entries show up here.
          </p>
        ) : (
          <ul className="max-h-96 overflow-y-auto py-1">
            {notifications.map((notification) => {
              const Icon = ICONS[notification.type as NotificationType] ?? BellIcon;

              return (
                <li key={notification.id}>
                  <button
                    type="button"
                    onClick={() => open(notification)}
                    disabled={isPending}
                    className={cn(
                      "hover:bg-muted flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                      !notification.readAt && "bg-muted/40",
                    )}
                  >
                    <Icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />

                    <span className="min-w-0 flex-1">
                      <span className="text-foreground block text-sm font-medium">
                        {notification.title}
                      </span>
                      <span className="text-muted-foreground mt-0.5 block text-xs">
                        {notification.body}
                      </span>
                      <span className="text-muted-foreground mt-1 block text-[11px]">
                        {timeAgo(notification.createdAt)}
                      </span>
                    </span>

                    {!notification.readAt && (
                      <span className="bg-primary mt-1.5 size-2 shrink-0 rounded-full" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default NotificationBell;
