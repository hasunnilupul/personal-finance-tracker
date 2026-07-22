"use client";

import { BarChart3, ChartColumn, LayoutDashboard, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type Tab = "dashboard" | "expenses" | "budgets" | "reports";

interface MobileBottomNavigationProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

const tabs = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    id: "expenses",
    label: "Expenses",
    icon: Wallet,
  },
  {
    id: "budgets",
    label: "Budgets",
    icon: ChartColumn,
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
  },
] as const;

export function MobileBottomNavigation({ activeTab, setActiveTab }: MobileBottomNavigationProps) {
  return (
    <nav className="bg-background/80 border-border supports-[backdrop-filter]:bg-background/70 fixed inset-x-0 bottom-0 z-50 border-t backdrop-blur md:hidden">
      <div className="mx-auto flex h-16 max-w-md items-center justify-around px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;

          return (
            <Button
              key={tab.id}
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex h-14 flex-1 flex-col gap-1 rounded-none",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className={cn("size-5 transition-all", active && "scale-110")} />

              <span className="text-[11px] font-medium">{tab.label}</span>

              {active && <span className="bg-primary absolute top-0 h-1 w-8 rounded-full" />}
            </Button>
          );
        })}
      </div>
    </nav>
  );
}
