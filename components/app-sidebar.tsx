"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

const tabs = [
  {
    href: "/",
    label: "Dashboard",
    icon: "📊",
  },
  {
    href: "/expenses",
    label: "Expenses",
    icon: "💰",
  },
  {
    href: "/budgets",
    label: "Budgets",
    icon: "📈",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: "📉",
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

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="bg-card border-border hidden w-64 flex-col border-r md:flex">
        <div className="p-6">
          <h1 className="text-foreground text-xl font-bold">FinanceFlow</h1>
        </div>

        <nav className="flex-1 space-y-2 px-3 py-4">
          {tabs.map((tab) => (
            <Button
              key={tab.href}
              variant={pathname === tab.href ? "default" : "ghost"}
              className="w-full justify-start"
            >
              <Link href={tab.href} className="flex w-full">
                <span className="mr-2">{tab.icon}</span>
                {tab.label}
              </Link>
            </Button>
          ))}
        </nav>

        <div className="border-border border-t p-4 text-center">
          <p className="text-muted-foreground text-xs">Track every expense, build better habits</p>
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="bg-card border-border fixed right-0 bottom-0 left-0 w-screen border-t md:hidden">
        <div className="flex items-center justify-around">
          {tabs.map((tab) => (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex min-w-16 flex-col items-center justify-center px-4 py-3 transition-colors ${
                pathname === tab.href
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              title={tab.label}
            >
              <span className="mb-1 text-xl">{tab.icon}</span>
              <span className="text-xs font-medium">{tab.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Mobile content padding to prevent overlap with bottom nav */}
      <div className="h-24 md:hidden" />
    </>
  );
}
