/**
 * Which build served the document this tab is running.
 *
 * All that is left of the update notice, which was removed on 2026-08-19. The
 * notice compared this id against a `/api/version` poll and offered a reload
 * when they differed; it was correct, and it was almost unreachable on the
 * device this app is actually used on. See PLAN.md for why it went.
 *
 * The id itself is still load-bearing. `serviceWorkerUrl()` keys the worker's
 * registration URL on it, which is the whole of Feature 13: the file's bytes
 * never change, so without a changing query the browser's update check finds
 * nothing and the worker installed on the first visit is the one it keeps.
 */

/**
 * The id of the build that served this document, straight from the markup.
 *
 * Next writes `data-dpl-id` onto `<html>` when `deploymentId` is configured, so
 * it is exact and available from the first paint.
 *
 * Browser-only — it touches `document`, so it must not be called during a
 * server render.
 */
export function loadedDeploymentId(): string | null {
  return document.documentElement.dataset.dplId || null;
}
