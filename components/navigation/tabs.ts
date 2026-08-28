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
 *
 * **Not every space has every page.** Income is recorded in a personal space
 * and nowhere else, so its tab is not shown in a shared one — a tab leading to
 * a page that redirects straight back is worse than no tab. See
 * {@link tabsFor}.
 */
export type Tab = {
  href: string;
  label: string;
  icon: string;
  primary?: boolean;
  /** Hidden in shared spaces, where the page it points at does not exist. */
  personalOnly?: boolean;
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
    personalOnly: true,
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

/**
 * The tabs a space actually has, split the way the bars need them.
 *
 * Computed per render rather than exported as three constants, because the
 * answer now depends on which space is open. The iOS bar sizes its grid and
 * places its pill from the lengths of these, so a filtered list is all it takes
 * for the bar to come out one column narrower — nothing about its geometry is
 * hard-coded to a count.
 */
export function tabsFor(isPersonal: boolean): {
  all: Tab[];
  primary: Tab[];
  overflow: Tab[];
} {
  const all = isPersonal ? tabs : tabs.filter((tab) => !tab.personalOnly);

  return {
    all,
    primary: all.filter((tab) => tab.primary),
    overflow: all.filter((tab) => !tab.primary),
  };
}
