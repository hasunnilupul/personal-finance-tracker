import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

type SettingsSection = "space" | "account";

const sections: { id: SettingsSection; href: string; label: string }[] = [
  { id: "space", href: "/settings/space", label: "Space" },
  { id: "account", href: "/settings/account", label: "Account" },
];

interface SettingsSubnavProps {
  current: SettingsSection;
}

/**
 * Switches between the two halves of settings.
 *
 * "Settings" is one tab in the bars, and it used to be one page. What a space
 * is set to and how an account is secured are different questions with
 * different owners — a member can change their own password and cannot change
 * the space's currency — so they are two pages, joined here rather than by
 * a second tab: ten tabs already do not fit across a phone.
 */
const SettingsSubnav = ({ current }: SettingsSubnavProps) => {
  return (
    <nav aria-label="Settings sections" className="flex gap-2">
      {sections.map((section) => (
        <Link
          key={section.id}
          href={section.href}
          aria-current={section.id === current ? "page" : undefined}
          className={buttonVariants({
            variant: section.id === current ? "default" : "outline",
            size: "sm",
          })}
        >
          {section.label}
        </Link>
      ))}
    </nav>
  );
};

export default SettingsSubnav;
