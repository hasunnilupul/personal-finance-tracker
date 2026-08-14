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
