/**
 * The service worker exists so the app can be installed. That is all it does.
 *
 * Chrome will not offer to install a PWA unless a registered service worker
 * has a `fetch` handler — a manifest and icons alone are not enough, which is
 * why the install prompt never appeared before this file existed. Offline
 * *support* is not required; the handler is.
 *
 * So it caches nothing, deliberately. Every dashboard page is dynamic and
 * cookie-gated, and caching one would put somebody's balances in the browser's
 * cache on a phone that can be lost or shared. A real offline story means
 * deciding what may be stored and adding a sync queue for writes; until that
 * decision is made, storing nothing is the honest position.
 *
 * Chrome has said it may eventually require a valid offline response rather
 * than merely a handler. If that lands, this file is where it gets answered.
 */

self.addEventListener("install", () => {
  // Nothing to precache, so take over as soon as the browser allows.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Intentionally empty. Not calling `event.respondWith()` leaves the request
  // to the network untouched — the worker observes, it does not intercept.
});

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
