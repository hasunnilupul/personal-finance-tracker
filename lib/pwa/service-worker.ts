/**
 * Where the page registers the service worker.
 *
 * `public/sw.js` is served byte-for-byte identical on every deployment, so the
 * browser's update check — which is a byte comparison — never finds anything.
 * The worker installed on the day someone first opened the app is the worker
 * they keep, and its `install` handler, which precaches `/offline` and the
 * icons, runs exactly once ever.
 *
 * Registering it under a versioned URL is what makes a deploy visible to it: a
 * script URL that differs by a query is a different script, so the browser
 * fetches it, installs it, and the existing `activate` cleanup drops the caches
 * belonging to versions that are no longer current.
 *
 * **The scope is unchanged**, which is the part that matters beyond caching.
 * `/sw.js?v=…` still has the path `/sw.js`, so it controls `/` exactly as
 * before and the *registration* — with the push subscription hanging off it —
 * is updated rather than replaced. A new registration would have quietly
 * unsubscribed every installed device from push.
 */
export const SERVICE_WORKER_PATH = "/sw.js";

/**
 * The registration URL for a given build.
 *
 * Falls back to the bare path when there is no deployment id, which is local
 * development and any host that sets none of the variables `deploymentId()`
 * reads. That is the pre-existing behaviour: one worker, updated only when the
 * file itself changes.
 *
 * **`dev=1` tells the worker not to cache-first the build output.** It has to
 * be told rather than work it out: a worker cannot read `NODE_ENV`, and the
 * hostname does not answer the question either — the smoke suite serves a real
 * production build from `localhost`, where caching is correct. The page knows
 * for certain, so the page says. See `isShellAsset` in `public/sw.js` for what
 * goes wrong without it.
 *
 * The flag rides in the **query, beside `v`**, for the same reason `v` does: the
 * path is unchanged, so the scope and the registration the push subscription
 * hangs off are unchanged, and only the script identity differs.
 */
export function serviceWorkerUrl(deploymentId: string | null, isDev = false): string {
  const params = new URLSearchParams();

  if (deploymentId) {
    params.set("v", deploymentId);
  }

  if (isDev) {
    params.set("dev", "1");
  }

  const query = params.toString();

  return query ? `${SERVICE_WORKER_PATH}?${query}` : SERVICE_WORKER_PATH;
}
