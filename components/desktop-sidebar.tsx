"use client";

import { Button } from "@/components/ui/button";

type Tab = "dashboard" | "expenses" | "budgets" | "reports";

interface SidebarProps {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export function Sidebar({ activeTab, setActiveTab }: SidebarProps) {
  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: "📊" },
    { id: "expenses", label: "Expenses", icon: "💰" },
    { id: "budgets", label: "Budgets", icon: "📈" },
    { id: "reports", label: "Reports", icon: "📉" },
  ] as const;

  return (
    <aside className="bg-card border-border hidden w-64 flex-col border-r md:flex">
      <div className="p-6">
        <h1 className="text-foreground text-xl font-bold">FinanceFlow</h1>
      </div>

      <nav className="flex-1 space-y-2 px-3 py-4">
        {tabs.map((tab) => (
          <Button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            variant={activeTab === tab.id ? "default" : "ghost"}
            className="w-full justify-start"
          >
            <span className="mr-2">{tab.icon}</span>
            {tab.label}
          </Button>
        ))}
      </nav>

      <div className="border-border border-t p-4 text-center">
        <p className="text-muted-foreground text-xs">Track every expense, build better habits</p>
      </div>
    </aside>
  );
}
