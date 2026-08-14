/**
 * Wiping the pages the service worker cached for the person who was signed in.
 *
 * Offline mode keeps rendered dashboard pages on the device, which means it
 * keeps balances on the device. That is only acceptable because it ends with
 * the session: this runs on sign-out, and again on sign-in, so a phone that
 * changes hands — or a browser two people in the household share — cannot show
 * the previous account's numbers to the next one.
 *
 * Done from the page rather than by messaging the worker. A page can reach the
 * Cache API directly, and one code path that always runs beats a `postMessage`
 * that needs an active worker to hear it — sign-out is exactly when the worker
 * might be starting up, replaced, or absent.
 */

/**
 * Must match `PRIVATE_CACHE_PREFIX` in `public/sw.js`.
 *
 * Matched by prefix rather than by exact name so a purge written against one
 * version still clears caches left by another.
 */
const PRIVATE_CACHE_PREFIX = "financeflow-private-";

/**
 * Deletes every private cache, and resolves either way.
 *
 * **Await this before navigating.** A pending `caches.delete` is abandoned when
 * the document unloads, which would leave the pages on disk under a session
 * that has ended.
 *
 * Never rejects: failing to clear a cache must not strand somebody on a page
 * they have just signed out of. The session is already gone server-side, so the
 * worst case is stale pages, not access.
 */
export async function purgePrivateCaches(): Promise<void> {
  // `caches` is tested directly rather than through `window`, because that is
  // what the body uses — checking one and calling the other is how a guard ends
  // up passing while the call it guards still throws.
  if (typeof window === "undefined" || typeof caches === "undefined") {
    return;
  }

  try {
    const names = await caches.keys();

    await Promise.all(
      names
        .filter((name) => name.startsWith(PRIVATE_CACHE_PREFIX))
        .map((name) => caches.delete(name)),
    );
  } catch {
    // Private browsing modes and some embedded webviews expose `caches` and
    // then refuse to open it. Nothing was cached in that case either.
  }
}
