"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import BrandMark from "@/components/brand-mark";
import MobileNav from "@/components/navigation/mobile-nav";
import { tabsFor } from "@/components/navigation/tabs";

/**
 * The desktop sidebar, and the mobile bar that stands in for it.
 *
 * The bar itself moved to `components/navigation/` on 2026-08-21, when it became
 * two bars — one per platform. This file keeps the sidebar and renders whichever
 * bar `MobileNav` chooses; the two never appear together, since one is `md:flex`
 * and the other `md:hidden`.
 *
 * `isPersonal` decides which pages exist to link to. It arrives as a prop from
 * the dashboard layout, which has already resolved the space to authorise the
 * request — asking again from a client component would be a round trip for
 * something the server knew before it rendered.
 */
export default function AppSidebar({ isPersonal }: { isPersonal: boolean }) {
  const pathname = usePathname();
  const { all: tabs } = tabsFor(isPersonal);

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="bg-card border-border hidden w-64 flex-col border-r md:flex">
        {/*
          `decorative`, because the wordmark beside it is the accessible name.
          Two marks share this page — the splash is in the root layout — so the
          gradient id has to differ from the splash's or the second one silently
          borrows the first's. See `components/brand-mark.tsx`.
        */}
        <div className="flex items-center gap-2.5 p-6">
          <BrandMark className="size-7 shrink-0" gradientId="ff-sidebar-mark-gradient" decorative />

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

      <MobileNav isPersonal={isPersonal} />
    </>
  );
}
