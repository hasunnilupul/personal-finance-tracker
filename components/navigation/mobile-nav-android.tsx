"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisIcon } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { tabsFor } from "@/components/navigation/tabs";

// One column per primary tab plus one for More, so the bar divides the width it
// has rather than growing past it.
const barItem =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-2.5 transition-colors";

/**
 * The bottom bar on Android, and the fallback for anything not recognised as
 * iOS.
 *
 * This is the bar the app has always shipped, unchanged apart from the extra
 * room under it. It is a near-copy of `mobile-nav-ios.tsx`, and the duplication
 * is the point: the two platforms have different bottom-bar conventions, and
 * the reason to split them was so that giving iOS its own design cannot move
 * anything here. Do not fold them back together to remove the repetition — the
 * shared part is the tab list, and that is already shared.
 *
 * **The bar sits above the bottom edge rather than on it.** `pb-5` is the whole
 * of that: with the icons flush to the edge they sat under the reach of a
 * gesture bar and read as though they were falling off the screen. Anything that
 * changes the bar's height has to move `pb-*` on the dashboard `<main>` and the
 * install hint's `bottom-*` with it — nothing computes those, they are matched
 * by hand.
 */
export default function MobileNavAndroid({ isPersonal }: { isPersonal: boolean }) {
  const pathname = usePathname();

  const { primary: primaryTabs, overflow: overflowTabs } = tabsFor(isPersonal);
  const inOverflow = overflowTabs.some((tab) => tab.href === pathname);

  return (
    // `data-platform` is what makes the split visible from outside. The two
    // bars render the same markup today, so without it nothing — not a test,
    // not somebody in devtools — could tell which one it is looking at.
    <nav
      data-platform="android"
      className="bg-card border-border fixed inset-x-0 bottom-0 z-10 border-t pb-5 md:hidden"
    >
      <div className="flex items-stretch">
        {primaryTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={pathname === tab.href ? "page" : undefined}
            className={cn(
              barItem,
              pathname === tab.href
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span className="text-xl">{tab.icon}</span>
            <span className="w-full truncate text-center text-[11px] font-medium">{tab.label}</span>
          </Link>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More pages"
            className={cn(
              barItem,
              inOverflow ? "text-primary" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <EllipsisIcon className="size-5" />
            <span className="w-full truncate text-center text-[11px] font-medium">More</span>
          </DropdownMenuTrigger>

          {/* Anchored to a narrow trigger, so the popup sets its own width. */}
          <DropdownMenuContent side="top" align="end" className="w-56">
            {overflowTabs.map((tab) => (
              <DropdownMenuItem
                key={tab.href}
                className={cn(pathname === tab.href && "text-primary")}
                render={<Link href={tab.href} />}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </nav>
  );
}
