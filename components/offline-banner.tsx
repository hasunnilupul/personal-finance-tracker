"use client";

import { useSyncExternalStore } from "react";
import { CloudOffIcon } from "lucide-react";

/**
 * Whether the browser thinks it has a connection.
 *
 * Read through `useSyncExternalStore` rather than set from an effect, the same
 * call `PwaProvider` makes: it is a browser fact, the server needs its own
 * snapshot for the markup to match, and it keeps
 * `react-hooks/set-state-in-effect` satisfied.
 */
function subscribe(listener: () => void): () => void {
  window.addEventListener("online", listener);
  window.addEventListener("offline", listener);

  return () => {
    window.removeEventListener("online", listener);
    window.removeEventListener("offline", listener);
  };
}

function isOffline(): boolean {
  return !navigator.onLine;
}

/**
 * Says so when the page being read came off the device rather than the server.
 *
 * Offline mode serves the last copy of a page it has, which for this app means
 * numbers that may have moved since. Showing them unlabelled would be the
 * dishonest half of caching them at all — a balance that is quietly two days
 * old is worse than one that says it is.
 *
 * `navigator.onLine` only knows whether there is *a* network, not whether it
 * reaches anything, so this can miss a captive portal. It cannot produce a
 * false alarm, though, which is the direction that matters here.
 */
const OfflineBanner = () => {
  // The server has no network state, so it renders nothing and the client
  // takes over on hydration.
  const offline = useSyncExternalStore(subscribe, isOffline, () => false);

  if (!offline) {
    return null;
  }

  return (
    <div
      role="status"
      className="bg-muted text-muted-foreground border-border flex items-center justify-center gap-2 border-b px-4 py-1.5 text-xs"
    >
      <CloudOffIcon className="size-3.5 shrink-0" />
      <span>Offline — showing the last version saved on this device. Changes will not save.</span>
    </div>
  );
};

export default OfflineBanner;
