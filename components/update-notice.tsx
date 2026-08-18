"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCwIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  hasNewDeployment,
  parseVersionResponse,
  VERSION_ENDPOINT,
} from "@/lib/version/update-check";

/**
 * How often to ask whether the server has moved on.
 *
 * Deliberately slow. A deployment here happens a few times a week at most, and
 * each check is a request from every open tab; the case that actually matters —
 * somebody coming back to a tab they left open yesterday — is covered by the
 * focus listener, not by the interval. Five minutes is for the tab left in
 * front for an afternoon.
 */
const POLL_INTERVAL_MS = 5 * 60_000;

/**
 * The id of the build that served this document, straight from the markup.
 *
 * Next writes `data-dpl-id` onto `<html>` when `deploymentId` is configured, so
 * this is exact and available from the first paint — no window in which a tab
 * loaded on the old build could mistake the new id for its own.
 */
function loadedDeploymentId(): string | null {
  return document.documentElement.dataset.dplId || null;
}

/**
 * Watches for the app being redeployed underneath an open tab, and offers a
 * reload when it happens.
 *
 * **The prompt never reloads on its own.** Somebody may be halfway through
 * typing an expense, and a page that refreshes itself would throw that away to
 * fix a problem they had not noticed. Next's own deployment-id support already
 * turns the *next navigation* into a hard one, so the only person this is for
 * is the one sitting still — and they can finish what they are doing first.
 *
 * Silent by construction wherever there is no id to compare: local development,
 * a self-hosted build with none of the variables set, a failed or unparseable
 * poll. See `hasNewDeployment`.
 */
const UpdateNotice = () => {
  const [availableId, setAvailableId] = useState<string | null>(null);
  const [dismissedId, setDismissedId] = useState<string | null>(null);

  useEffect(() => {
    // Captured once, before any polling: this is the build the tab is running.
    // If it is absent the feature is not configured, and the effect does
    // nothing at all rather than polling for an answer it could not use.
    const loaded = loadedDeploymentId();

    if (!loaded) {
      return;
    }

    const controller = new AbortController();

    const check = async () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      try {
        const response = await fetch(VERSION_ENDPOINT, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!response.ok) {
          return;
        }

        const live = parseVersionResponse(await response.json());

        if (hasNewDeployment(loaded, live)) {
          setAvailableId(live);
        }
      } catch {
        // Offline, aborted, or an answer that was not JSON. A version check is
        // the least important request the app makes; failing it silently is
        // the whole contract.
      }
    };

    const interval = setInterval(check, POLL_INTERVAL_MS);

    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);

    // Not on mount: the document that just arrived came from the deployment
    // being asked about, so the first useful moment is the first time this tab
    // is returned to.

    return () => {
      controller.abort();
      clearInterval(interval);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const reload = useCallback(async () => {
    // Give the worker a chance to notice a changed script before the document
    // is replaced, so the new page is served by the new worker rather than by
    // the one the old build registered.
    try {
      const registration = await navigator.serviceWorker?.getRegistration();

      await registration?.update();
    } catch {
      // A worker that cannot update does not stop the page from reloading, and
      // the reload is the part that matters.
    }

    window.location.reload();
  }, []);

  if (!availableId || availableId === dismissedId) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-card border-border pointer-events-auto flex w-full max-w-md items-start gap-3 border p-3 shadow-2xl"
    >
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-medium">A new version of FinanceFlow is out</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Reload when you are ready. Anything you are part-way through typing will be lost.
        </p>
      </div>

      <Button size="sm" onClick={reload}>
        <RefreshCwIcon />
        Reload
      </Button>

      <Button
        variant="ghost"
        size="icon-sm"
        // Dismissing this id rather than the notice: a later deployment is a
        // new piece of news and says so again.
        onClick={() => setDismissedId(availableId)}
        aria-label="Dismiss the update notice"
      >
        <XIcon />
      </Button>
    </div>
  );
};

export default UpdateNotice;
