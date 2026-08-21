/**
 * Every destination, in sidebar order.
 *
 * One list, three renderings: the desktop sidebar shows all of it, and both
 * mobile bars split it the same way. `primary` marks the four that earn a slot
 * in a bar — ten tabs do not fit across a phone, and a bar that overflows hides
 * its last items with nothing to say they are there. The rest are reached
 * through "More".
 *
 * A new page is added here and appears in all three.
 */
export type Tab = {
  href: string;
  label: string;
  icon: string;
  primary?: boolean;
};

export const tabs: Tab[] = [
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

export const primaryTabs = tabs.filter((tab) => tab.primary);
export const overflowTabs = tabs.filter((tab) => !tab.primary);
