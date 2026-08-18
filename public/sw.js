/**
 * The service worker: installability, push, and a read-only offline mode.
 *
 * It started out caching nothing at all, because every dashboard page is
 * dynamic and cookie-gated and caching one puts somebody's balances on the
 * device. That is still true — what changed is that the consequence is now
 * handled rather than avoided. Two caches, with different rules:
 *
 * - `SHELL_CACHE` holds build output and icons. Hashed, immutable, and about
 *   nobody: it survives sign-out.
 * - `PAGES_CACHE` holds rendered pages, which means balances. It is wiped on
 *   sign-out and again on sign-in, so a device that changes hands does not
 *   carry the previous session's numbers.
 *
 * `PRIVATE_CACHE_PREFIX` is duplicated in `lib/pwa/private-cache.ts`, which is
 * what does the wiping — a page can reach the Cache API directly, and one code
 * path that always runs beats a `postMessage` that needs a live worker to hear
 * it. Change the prefix in both places or the purge silently stops matching.
 *
 * Deliberately hand-written. The Next.js PWA guide recommends Serwist, which
 * needs webpack configuration; this project builds with Turbopack.
 */

/**
 * Which build this worker belongs to, read out of its own script URL.
 *
 * The page registers `/sw.js?v=<deployment id>`, and a script URL that differs
 * by a query is a different script to the browser — which is the only way this
 * file ever changes. Its bytes are identical from one deployment to the next,
 * so without the query there is no update to find: `install` never runs again,
 * the shell cache keeps the previous build's `/offline`, and every deployment
 * adds another copy of the static assets it touches rather than replacing one.
 *
 * With it, a deploy installs a new worker, `install` precaches the new build's
 * assets, and the `activate` cleanup below drops every cache belonging to a
 * version that is no longer current — which is the whole point.
 *
 * `v1` when there is no id: local development, and any deployment that sets
 * none of the variables behind `deploymentId()`. The behaviour there is exactly
 * what it was before, which is the right thing for a build that has no identity
 * to key on.
 */
const VERSION = new URL(self.location.href).searchParams.get("v") || "v1";

const SHELL_CACHE = `financeflow-shell-${VERSION}`;

/** Must match `PRIVATE_CACHE_PREFIX` in `lib/pwa/private-cache.ts`. */
const PRIVATE_CACHE_PREFIX = "financeflow-private-";

const PAGES_CACHE = `${PRIVATE_CACHE_PREFIX}${VERSION}`;

/**
 * What is fetched at install time so the app opens offline at all.
 *
 * Only things that are the same for everybody. `/offline` is the last resort
 * for a page that was never visited; it is a public route, so precaching it
 * cannot accidentally store a redirect to sign-in.
 */
const SHELL_ASSETS = ["/offline", "/manifest.webmanifest", "/icon-192.png", "/icon-512.png"];

/** Requests that must never be served from, or written to, a cache. */
function isNeverCacheable(url) {
  return (
    // better-auth's endpoints and the cron routes. A cached session response
    // is a stale answer to "who is signed in", which is the one question that
    // must always hit the server.
    url.pathname.startsWith("/api/") ||
    // The worker itself. A cached worker is how a PWA gets stuck on an old
    // build — `next.config.ts` says so in a header, and this agrees.
    url.pathname === "/sw.js"
  );
}

/** Build output and icons: hashed or versioned, so safe to keep indefinitely. */
function isShellAsset(url) {
  return url.pathname.startsWith("/_next/static/") || SHELL_ASSETS.includes(url.pathname);
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      // Individually rather than `addAll`, which rejects the whole batch if a
      // single asset 404s and would leave the worker uninstalled — losing push
      // and the install prompt over a missing icon.
      await Promise.all(
        SHELL_ASSETS.map(async (asset) => {
          try {
            await cache.add(asset);
          } catch {
            // Logged nowhere on purpose: a worker's console is invisible in
            // normal use, and the fetch handler falls back to the network.
          }
        }),
      );

      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop every cache from an older VERSION. Without this a bumped version
      // adds caches rather than replacing them, and the old pages stay
      // readable — including the private ones.
      const names = await caches.keys();

      await Promise.all(
        names
          .filter((name) => name !== SHELL_CACHE && name !== PAGES_CACHE)
          .filter((name) => name.startsWith("financeflow-"))
          .map((name) => caches.delete(name)),
      );

      await self.clients.claim();
    })(),
  );
});

/**
 * Cache-first for the shell, network-first for pages, and hands off everything
 * else untouched.
 *
 * Not intercepting is a real strategy here rather than a gap: an RSC fetch —
 * what the router sends when navigating inside the app — is left alone, so
 * offline it fails the way Next expects and the router falls back to a full
 * navigation, which this *does* answer from the page cache. Caching those
 * payloads instead would mean keying on the `_rsc` hash and serving a client
 * half of a page whose server half came from somewhere else.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Server actions and form posts. Never cached, never replayed — a queue for
  // offline writes is a separate feature with its own idempotency problem.
  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin || isNeverCacheable(url)) {
    return;
  }

  if (isShellAsset(url)) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request));
  }
});

/**
 * Serves from the cache, falling back to the network and storing what it gets.
 *
 * Safe only for immutable things: a `/_next/static/` path carries a build hash,
 * so a changed file is a changed URL and this can never go stale.
 */
async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) {
    return cached;
  }

  const response = await fetch(request);

  if (response.ok) {
    const cache = await caches.open(SHELL_CACHE);

    await cache.put(request, response.clone());
  }

  return response;
}

/**
 * Tries the network, keeps a copy, and falls back to that copy when there is
 * no network.
 *
 * Network-first rather than cache-first because a balance the app is *sure*
 * about beats one it can serve quickly. The cached copy is what somebody sees
 * on a train, and the banner says so.
 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);

    // Only a plain 200 is worth keeping. A redirect is the proxy sending an
    // expired session to sign-in, and caching that under the page's own URL
    // would pin the app to the sign-in screen offline.
    if (response.ok && response.type === "basic" && !response.redirected) {
      const cache = await caches.open(PAGES_CACHE);

      await cache.put(request, response.clone());
    }

    return response;
  } catch {
    const cached = await caches.match(request);

    if (cached) {
      return cached;
    }

    // A page never visited while online. The offline page explains that rather
    // than leaving the browser to show its own dinosaur.
    const fallback = await caches.match("/offline");

    if (fallback) {
      return fallback;
    }

    return new Response("You are offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
}

/**
 * Shows a pushed notification.
 *
 * The payload is small on purpose — the record lives in the database, this is
 * only the pop-up. `tag` carries the same dedupe key the row was written with,
 * so a phone that was offline and receives two of the same collapses them into
 * one rather than stacking them.
 */
self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  let payload;

  try {
    payload = event.data.json();
  } catch {
    // A push from something that is not this app, or a truncated body. Showing
    // a notification with no content would be worse than showing none.
    return;
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: payload.tag,
      data: { href: payload.href || "/" },
    }),
  );
});

/**
 * Opens the app where the notification points.
 *
 * Focuses a window that is already open rather than adding another — an app
 * installed to a home screen usually has exactly one, and a second copy of it
 * is not what tapping a notification should produce.
 */
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const href = event.notification.data?.href || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate?.(href);

          return client.focus();
        }
      }

      return self.clients.openWindow(href);
    }),
  );
});
