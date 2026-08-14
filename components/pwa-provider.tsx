"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ShareIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger/logger";

const DISMISSED_KEY = "financeflow:install-hint-dismissed";

/**
 * Whether the page is already running as an installed app.
 *
 * iOS reports this on `navigator`, everything else through the media query.
 */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** iPadOS 13+ claims to be a Mac, so touch points are the tell. */
function isIos(): boolean {
  const ua = window.navigator.userAgent;

  return (
    /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)
  );
}

// Whether to show the hint is a browser fact — user agent, display mode,
// localStorage — so it is read through `useSyncExternalStore` rather than set
// from an effect. That gives the server a snapshot of its own (`false`, so the
// markup matches) and keeps `react-hooks/set-state-in-effect` satisfied, which
// is the rule this file would otherwise trip. See Gotchas.
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

function shouldShowHint(): boolean {
  if (localStorage.getItem(DISMISSED_KEY) === "1" || isStandalone()) {
    return false;
  }

  return isIos();
}

function dismissHint(): void {
  localStorage.setItem(DISMISSED_KEY, "1");
  listeners.forEach((listener) => listener());
}

/**
 * Registers the service worker, and tells iOS users how to install.
 *
 * Two halves of the same problem. Chrome needs a worker with a `fetch` handler
 * before it will offer to install at all; Safari has never offered, on any
 * version, and never will — on iOS the only route is Share ▸ Add to Home
 * Screen, so the app has to say so itself or nobody finds it.
 */
const PwaProvider = () => {
  const showHint = useSyncExternalStore(subscribe, shouldShowHint, () => false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      // A failed registration costs the install prompt, not the app.
      logger.error("Service worker registration failed", error);
    });
  }, []);

  if (!showHint) {
    return null;
  }

  return (
    // Sits above the mobile bottom navigation, which is 4rem tall and fixed.
    <div className="fixed inset-x-3 bottom-20 z-50 md:bottom-4">
      <div className="bg-card border-border mx-auto flex max-w-md items-start gap-3 rounded-2xl border p-3 shadow-2xl">
        <div className="min-w-0 flex-1">
          <p className="text-foreground text-sm font-medium">Add FinanceFlow to your home screen</p>
          <p className="text-muted-foreground mt-1 flex flex-wrap items-center gap-1 text-xs">
            Tap
            <ShareIcon className="inline size-3.5" aria-label="the Share button" />
            in the browser bar, then <span className="text-foreground">Add to Home Screen</span>.
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={dismissHint}
          aria-label="Dismiss the install hint"
        >
          <XIcon />
        </Button>
      </div>
    </div>
  );
};

export default PwaProvider;
