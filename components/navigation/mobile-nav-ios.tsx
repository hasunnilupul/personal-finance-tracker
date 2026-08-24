"use client";

import type { CSSProperties } from "react";
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

/** Every primary tab, plus the "More" column. */
const COLUMNS = primaryTabs.length + 1;

/** The index "More" occupies, which is always the last column. */
const MORE_INDEX = primaryTabs.length;

/**
 * The bottom bar on iOS and iPadOS.
 *
 * A floating glass capsule rather than Android's full-width surface. That is
 * the platform tell and it is not decoration: an inset bar is the only shape
 * with anything behind it to refract, and a bar that is part of the screen
 * cannot be made of glass however it is tinted. Styling lives in
 * `app/globals.css` under "iOS bottom bar" — `backdrop-filter: url(#…)` and the
 * `forced-colors` fallback have no utility form, and splitting the effect in
 * two would leave nowhere to explain it.
 *
 * **Nothing here is shared with `mobile-nav-android.tsx` except the tab list.**
 * The duplication between the two files is the point: this design can grow
 * without a single Android phone seeing a pixel move.
 */
export default function MobileNavIos() {
  const pathname = usePathname();

  const primaryIndex = primaryTabs.findIndex((tab) => tab.href === pathname);
  const inOverflow = overflowTabs.some((tab) => tab.href === pathname);

  // Which column the pill sits under. A route matching no tab at all — a
  // nested page such as a future `/expenses/123` — parks it nowhere rather
  // than on Dashboard, because a pill under the wrong tab is a confident lie
  // about where you are.
  const activeIndex = primaryIndex >= 0 ? primaryIndex : inOverflow ? MORE_INDEX : null;

  return (
    <>
      {/*
        The displacement map, drawn rather than shipped. The reference design
        carried a ~30KB base64 WebP, inlined twice; this is the same idea in
        about 500 bytes of gradients. Neutral is 128 in both channels: red
        drives horizontal displacement and green vertical, so a ramp running
        255 → 128 → 0 across the box bends content inwards at the edges and
        leaves the middle alone. The two rects composite with `screen`, which
        works precisely because each one zeroes the other's channel.

        `scale` is up from 0.06, and that is the tint change and not a second
        opinion about how much glass bends light. Displacement can only move
        pixels that are visible: behind a bar covering 90% of what was there,
        0.06 and 0.20 look identical. See the tint note in `globals.css`.

        It is rendered *inside this component*, so it exists exactly once and
        only on the platform that uses it — `MobileNav` renders one bar, never
        both. A shared filter in the root layout would be a duplicate-id waiting
        to happen, which is the trap `BrandMark`'s `gradientId` already exists
        to avoid.
      */}
      <svg className="ff-iosbar-filter" aria-hidden="true" focusable="false">
        <filter
          id="ff-glass-refraction"
          primitiveUnits="objectBoundingBox"
          x="0"
          y="0"
          width="100%"
          height="100%"
        >
          <feImage
            result="map"
            x="0"
            y="0"
            width="100%"
            height="100%"
            href="data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='320' height='64'%3E%3ClinearGradient id='h' x1='0' x2='1'%3E%3Cstop offset='0' stop-color='rgb(255,0,0)'/%3E%3Cstop offset='0.14' stop-color='rgb(128,0,0)'/%3E%3Cstop offset='0.86' stop-color='rgb(128,0,0)'/%3E%3Cstop offset='1' stop-color='rgb(0,0,0)'/%3E%3C/linearGradient%3E%3ClinearGradient id='v' x1='0' y1='0' x2='0' y2='1'%3E%3Cstop offset='0' stop-color='rgb(0,255,0)'/%3E%3Cstop offset='0.42' stop-color='rgb(0,128,0)'/%3E%3Cstop offset='0.58' stop-color='rgb(0,128,0)'/%3E%3Cstop offset='1' stop-color='rgb(0,0,0)'/%3E%3C/linearGradient%3E%3Crect width='320' height='64' fill='url(%23h)'/%3E%3Crect width='320' height='64' fill='url(%23v)' style='mix-blend-mode:screen'/%3E%3C/svg%3E"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="map"
            scale="0.09"
            xChannelSelector="R"
            yChannelSelector="G"
          />
        </filter>
      </svg>

      {/*
        The strip the capsule floats in. Without it the bar is glass over
        nothing: the page runs sharp and full strength past its left and right
        ends and under its bottom, so the bar reads as a cut-out rather than as
        an object laid over the screen. Apple's own tab bar does this — the
        band below the bar is blurred and shaded, which is what stops those
        edges being transparent.

        A sibling rather than a child of the bar, and that is load-bearing: an
        element with `backdrop-filter` establishes a backdrop root, so nested
        inside `.ff-iosbar` this would blur the bar's backdrop instead of the
        page and quietly render nothing at all.
      */}
      <div aria-hidden="true" className="ff-iosbar-scrim md:hidden" />

      <nav
        data-platform="ios"
        className="ff-iosbar md:hidden"
        style={{ "--ff-count": COLUMNS } as CSSProperties}
      >
        {/*
          Decorative. The current tab is announced by `aria-current` on the link
          itself, so a screen reader gains nothing from the pill and would only
          hear an extra empty element.
        */}
        <span
          aria-hidden="true"
          className="ff-iosbar-pill"
          data-hidden={activeIndex === null}
          style={{ "--ff-index": activeIndex ?? 0 } as CSSProperties}
        />

        {primaryTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={pathname === tab.href ? "page" : undefined}
            className={cn("ff-iosbar-item", "transition-colors")}
          >
            <span className="ff-iosbar-icon">{tab.icon}</span>
            <span className="ff-iosbar-label">{tab.label}</span>
          </Link>
        ))}

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="More pages"
            data-active={inOverflow}
            className={cn("ff-iosbar-item", "transition-colors")}
          >
            <EllipsisIcon className="size-5" />
            <span className="ff-iosbar-label">More</span>
          </DropdownMenuTrigger>

          {/* Anchored to a narrow trigger, so the popup sets its own width. */}
          <DropdownMenuContent side="top" align="end" sideOffset={12} className="w-56">
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
      </nav>
    </>
  );
}
