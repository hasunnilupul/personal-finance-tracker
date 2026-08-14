"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { EllipsisIcon } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Every destination, in sidebar order.
 *
 * `primary` marks the four that earn a slot in the mobile bar. The rest are
 * reached through "More" — ten tabs do not fit across a phone, and a bar that
 * overflows hides its last items with nothing to say they are there.
 */
const tabs = [
  {
    href: "/",
    label: "Dashboard",
    icon: "📊",
    primary: true,
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: "💰",
    primary: true,
  },
  {
    href: "/income",
    label: "Income",
    icon: "💵",
    primary: true,
  },
  {
    href: "/budgets",
    label: "Budgets",
    icon: "📈",
    primary: true,
  },
  {
    href: "/reports",
    label: "Reports",
    icon: "📉",
  },
  {
    href: "/goals",
    label: "Goals",
    icon: "🎯",
  },
  {
    href: "/recurring",
    label: "Recurring",
    icon: "🔁",
  },
  {
    href: "/settings/categories",
    label: "Categories",
    icon: "🏷️",
  },
  {
    href: "/settings/members",
    label: "Members",
    icon: "👥",
  },
  {
    href: "/settings/space",
    label: "Settings",
    icon: "⚙️",
  },
];

const primaryTabs = tabs.filter((tab) => tab.primary);
const overflowTabs = tabs.filter((tab) => !tab.primary);

// One column per primary tab plus one for More, so the bar divides the width it
// has rather than growing past it.
const barItem =
  "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2.5 transition-colors";

export default function AppSidebar() {
  const pathname = usePathname();
  const inOverflow = overflowTabs.some((tab) => tab.href === pathname);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="bg-card border-border hidden w-64 flex-col border-r md:flex">
        <div className="p-6">
          <h1 className="text-foreground text-xl font-bold">FinanceFlow</h1>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {tabs.map((tab) => (
            // A link styled as a button, not a Button rendering a link: the
            // whole padded row navigates and it is still announced as a link.
            // See Gotchas.
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={pathname === tab.href ? "page" : undefined}
              className={cn(
                buttonVariants({ variant: pathname === tab.href ? "default" : "ghost" }),
                "w-full justify-start",
              )}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className="border-border border-t p-4 text-center">
          <p className="text-muted-foreground text-xs">Track every expense, build better habits</p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="bg-card border-border fixed inset-x-0 bottom-0 border-t md:hidden">
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
              <span className="w-full truncate text-center text-[11px] font-medium">
                {tab.label}
              </span>
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

      {/* Mobile content padding to prevent overlap with bottom nav */}
      <div className="h-24 md:hidden" />
    </>
  );
}
