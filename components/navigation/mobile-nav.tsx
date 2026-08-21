"use client";

import MobileNavAndroid from "@/components/navigation/mobile-nav-android";
import MobileNavIos from "@/components/navigation/mobile-nav-ios";
import { useMobilePlatform } from "@/components/navigation/use-mobile-platform";

/**
 * The bottom bar, picked by platform.
 *
 * **Exactly one bar is rendered**, not both with one hidden. Two `<nav>`
 * elements in the same document would each be a navigation landmark to a screen
 * reader and each be a match for anything looking one up by role — including the
 * smoke suite, which asserts against `getByRole("navigation")` and would fail
 * strict mode rather than pass twice.
 *
 * Both are `md:hidden`, so a desktop browser renders a bar it never shows and
 * the sidebar in `components/app-sidebar.tsx` is what is actually on screen.
 */
export default function MobileNav() {
  const platform = useMobilePlatform();

  return platform === "ios" ? <MobileNavIos /> : <MobileNavAndroid />;
}
