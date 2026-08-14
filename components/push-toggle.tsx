"use client";

import { useEffect, useState, useTransition } from "react";
import { BellIcon, BellOffIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { subscribeToPushAction, unsubscribeFromPushAction } from "@/app/actions/push.actions";
import { logger } from "@/lib/logger";

interface PushToggleProps {
  /** Server-side truth: without VAPID keys there is nothing to subscribe to. */
  configured: boolean;
  publicKey: string;
}

type State = "loading" | "unsupported" | "needs-install" | "denied" | "off" | "on";

/**
 * The applicationServerKey has to be bytes, and the key is base64url text.
 *
 * Typed as `Uint8Array<ArrayBuffer>` rather than plain `Uint8Array`: the DOM
 * types now require a buffer that cannot be a `SharedArrayBuffer`, and the
 * default generic admits one.
 */
function toUint8Array(base64Url: string): Uint8Array<ArrayBuffer> {
  const padded = base64Url.padEnd(base64Url.length + ((4 - (base64Url.length % 4)) % 4), "=");
  const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes;
}

function isIos(): boolean {
  const ua = window.navigator.userAgent;

  return (
    /iphone|ipad|ipod/i.test(ua) || (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)
  );
}

function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Turns OS notifications on for this device.
 *
 * Per device, not per account — permission belongs to a browser installation,
 * so the phone and the laptop are asked separately and each gets its own row.
 *
 * The states are all real cases rather than defensive padding: Safari on iOS
 * exposes no push API at all until the app is installed to the home screen,
 * and a denied permission cannot be re-requested from script — the browser
 * ignores the call — so the only honest thing is to say where the setting is.
 */
const PushToggle = ({ configured, publicKey }: PushToggleProps) => {
  const [state, setState] = useState<State>("loading");
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    // One async pass rather than early returns that call setState in the
    // effect body — `react-hooks/set-state-in-effect` fails that, and asking
    // the browser what it supports is asynchronous at the end of it anyway.
    let cancelled = false;

    const detect = async (): Promise<State> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
        // On iOS this is what "not installed yet" looks like: the API is
        // absent until the app is on the home screen.
        return isIos() && !isStandalone() ? "needs-install" : "unsupported";
      }

      if (Notification.permission === "denied") {
        return "denied";
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        return subscription ? "on" : "off";
      } catch {
        return "off";
      }
    };

    void detect().then((next) => {
      if (!cancelled) {
        setState(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const enable = () => {
    startTransition(async () => {
      try {
        const permission = await Notification.requestPermission();

        if (permission !== "granted") {
          setState(permission === "denied" ? "denied" : "off");
          return;
        }

        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.subscribe({
          // Every push must be attributable to this app, and Chrome refuses a
          // subscription without it.
          userVisibleOnly: true,
          applicationServerKey: toUint8Array(publicKey),
        });

        const result = await subscribeToPushAction(subscription.toJSON());

        if (result.error) {
          toast.error(result.error);
          return;
        }

        setState("on");
        toast.success(result.success ?? "Notifications on");
      } catch (error) {
        logger.error("Failed to enable push", error);
        toast.error("Could not turn notifications on for this device.");
      }
    });
  };

  const disable = () => {
    startTransition(async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
          // Server first: a subscription dropped locally but left in the
          // database would be pushed to for ever with nothing listening.
          await unsubscribeFromPushAction(subscription.endpoint);
          await subscription.unsubscribe();
        }

        setState("off");
        toast.success("This device will stop getting notifications.");
      } catch (error) {
        logger.error("Failed to disable push", error);
        toast.error("Could not turn notifications off.");
      }
    });
  };

  const description: Record<State, string> = {
    loading: "Checking this device…",
    unsupported: "This browser cannot show notifications.",
    "needs-install": "Add FinanceFlow to your home screen first — iOS only allows it there.",
    denied: "Blocked in your browser settings. Allow notifications for this site to turn them on.",
    off: "Get told about overspending and recurring entries, even when the app is closed.",
    on: "This device is getting notifications.",
  };

  return (
    <Card className="p-6">
      <h2 className="text-foreground text-base font-semibold">Notifications on this device</h2>

      <p className="text-muted-foreground mt-1 text-sm">
        {configured ? description[state] : "Push is not configured on the server."}
      </p>

      {configured && state === "off" && (
        <Button className="mt-4" onClick={enable} disabled={isPending}>
          <BellIcon />
          {isPending ? "Turning on…" : "Turn on"}
        </Button>
      )}

      {configured && state === "on" && (
        <Button className="mt-4" variant="outline" onClick={disable} disabled={isPending}>
          <BellOffIcon />
          {isPending ? "Turning off…" : "Turn off"}
        </Button>
      )}

      <p className="text-muted-foreground mt-3 text-xs">
        Every notification is kept in the bell whether or not this is on — it decides where they pop
        up, not whether they happen.
      </p>
    </Card>
  );
};

export default PushToggle;
