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
import { overflowTabs, primaryTabs } from "@/components/navigation/tabs";

// One column per primary tab plus one for More, so the bar divides the width it
// has rather than growing past it.
const barItem =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 pt-2.5 transition-colors";

/**
 * The bottom bar on iOS and iPadOS.
 *
 * **It is deliberately identical to `mobile-nav-android.tsx` today.** This file
 * exists so that there is somewhere for Apple's tab-bar conventions to go — the
 * taller bar, the different label and pressed-state rules, the home indicator to
 * clear — without every edit risking the bar every other device sees. The design
 * is still to come from the repo owner; until it lands, an iPhone gets exactly
 * what it got before, which is why shipping the split ahead of the design costs
 * nothing.
 *
 * When that design arrives it goes **here, and only here**. The two files share
 * their tab list and nothing else, so this one is free to grow its own markup.
 *
 * `pb-5` is the extra room under the icons, matched to Android's. iOS is the
 * platform where it matters most, since the home indicator sits in that strip on
 * every phone since the X. Note it is a plain value rather than
 * `env(safe-area-inset-bottom)`: that reports zero unless the viewport is
 * declared `viewport-fit=cover`, and this app does not, so an `env()` here would
 * look like it was doing the work while contributing nothing.
 */
export default function MobileNavIos() {
  const pathname = usePathname();
  const inOverflow = overflowTabs.some((tab) => tab.href === pathname);

  return (
    // See the note in `mobile-nav-android.tsx`: with both bars rendering the
    // same markup, this attribute is the only way to tell them apart.
    <nav
      data-platform="ios"
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
