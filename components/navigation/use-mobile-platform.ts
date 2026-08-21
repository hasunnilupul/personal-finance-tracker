"use client";

import { useSyncExternalStore } from "react";

import { detectMobilePlatform, type MobilePlatform } from "@/lib/pwa/platform";

/**
 * The platform is a browser fact — it comes off the user agent — so it is read
 * through `useSyncExternalStore` rather than set from an effect. That gives the
 * server a snapshot of its own, keeps `react-hooks/set-state-in-effect`
 * satisfied, and hands React the hydration mismatch as something it expects
 * rather than something it warns about. `components/pwa-provider.tsx` reads the
 * install hint the same way, for the same reasons.
 *
 * Nothing ever changes it — a device does not stop being an iPhone mid-session
 * — so `subscribe` has nothing to listen to and returns a no-op.
 */
function subscribe(): () => void {
  return () => {};
}

function getSnapshot(): MobilePlatform {
  return detectMobilePlatform(window.navigator);
}

/**
 * **The server renders Android's bar.** There is no user agent to read while
 * the HTML is being built, and the alternatives are worse: rendering neither
 * bar leaves a phone with no navigation until hydration, and reading the request
 * header would make every dashboard page vary by user agent — uncacheable, for a
 * choice between two bars in the same place. iOS swaps to its own immediately
 * after hydration.
 *
 * Today that swap is invisible, because the two bars are the same design. Once
 * iOS gets its own it will be a change on screen for an iPhone, in the first
 * moments of the first paint. If that reads badly, the fix is to render the bar
 * from a CSS-only signal, not to move this into an effect — an effect runs at
 * the same time and only adds a lint rule to argue with.
 */
export function useMobilePlatform(): MobilePlatform {
  return useSyncExternalStore(subscribe, getSnapshot, (): MobilePlatform => "android");
}
