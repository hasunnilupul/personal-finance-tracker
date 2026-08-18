"use client";

import { useEffect, useSyncExternalStore } from "react";
import { ShareIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import UpdateNotice from "@/components/update-notice";
import { serviceWorkerUrl } from "@/lib/pwa/service-worker";
import { loadedDeploymentId } from "@/lib/version/update-check";
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
 * Registers the service worker, and owns the two notices that hang off the
 * bottom of the app: how to install it, and that it has been redeployed.
 *
 * The install hint is two halves of one problem. Chrome needs a worker with a
 * `fetch` handler before it will offer to install at all; Safari has never
 * offered, on any version, and never will — on iOS the only route is Share ▸
 * Add to Home Screen, so the app has to say so itself or nobody finds it.
 *
 * The worker now also serves offline reads and shows pushes, which raises the
 * cost of a stale one: it would keep answering navigations from an old cache.
 *
 * Both notices share one fixed stack rather than each pinning itself to the
 * bottom of the screen, because on an iPhone that has not installed the app
 * yet they can be on screen at the same time and two `fixed` cards at the same
 * offset would sit on top of each other.
 */
const PwaProvider = () => {
  const showHint = useSyncExternalStore(subscribe, shouldShowHint, () => false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker
      // Versioned by the build that served this page. The file's own bytes
      // never change, so without the query the browser's update check finds
      // nothing and the worker installed on the first visit is the one it
      // keeps — see `serviceWorkerUrl`. The path, and therefore the scope and
      // the registration the push subscription belongs to, is unchanged.
      .register(serviceWorkerUrl(loadedDeploymentId()), {
        // Never satisfy the worker's own update check from the HTTP cache.
        // `next.config.ts` already sends `no-store` for `/sw.js`; this is the
        // half that does not depend on a host or a CDN honouring it, and a
        // worker that cannot update is a PWA pinned to an old build.
        updateViaCache: "none",
      })
      .catch((error) => {
        // A failed registration costs the install prompt and offline reads,
        // not the app.
        logger.error("Service worker registration failed", error);
      });
  }, []);

  return (
    // Sits above the mobile bottom navigation, which is 4rem tall and fixed.
    // The stack itself never takes a click — it is full-width and mostly empty,
    // so only the cards inside it are given pointer events back.
    <div className="pointer-events-none fixed inset-x-3 bottom-20 z-50 flex flex-col items-center gap-2 md:bottom-4">
      <UpdateNotice />

      {showHint && (
        <div className="bg-card border-border pointer-events-auto flex w-full max-w-md items-start gap-3 border p-3 shadow-2xl">
          <div className="min-w-0 flex-1">
            <p className="text-foreground text-sm font-medium">
              Add FinanceFlow to your home screen
            </p>
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
      )}
    </div>
  );
};

export default PwaProvider;
