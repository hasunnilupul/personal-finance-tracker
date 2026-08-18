/**
 * Deciding whether the build a tab is running has been replaced.
 *
 * The comparison is trivial and the ways it can be wrong are not, which is why
 * it lives here with tests rather than inside the component. Every one of them
 * fails the same quiet way — a banner that never appears, or one that appears
 * when nothing has changed — and neither is visible in a screenshot.
 */

/** Where the running deployment reports its own id. Never cached, never guarded. */
export const VERSION_ENDPOINT = "/api/version";

/**
 * The id from a `/api/version` body, or `null` for anything unexpected.
 *
 * Defensive because this response is not always the one it asked for: a captive
 * portal, a proxy, or an offline service worker can answer with HTML or with a
 * shape from another build. Treating junk as an id would show "a new version is
 * available" to somebody sitting on airport wifi.
 */
export function parseVersionResponse(payload: unknown): string | null {
  if (typeof payload !== "object" || payload === null) {
    return null;
  }

  const { deploymentId } = payload as { deploymentId?: unknown };

  return typeof deploymentId === "string" && deploymentId.length > 0 ? deploymentId : null;
}

/**
 * Whether `live` is a different build from the one the tab loaded.
 *
 * Different, not newer: ids are opaque — an opaque `dpl_…`, a commit sha, a
 * hostname — so there is no ordering to read out of them. A rollback is a new
 * version for this purpose, and telling somebody to refresh into the previous
 * build is right, because that is what the server is now serving.
 *
 * An unknown id on either side means "no answer", never "changed". Both are
 * ordinary: the id is undefined outside a deployment, and a poll that fails —
 * offline, a 500, a truncated body — must not be read as news.
 */
export function hasNewDeployment(loaded: string | null, live: string | null): boolean {
  if (!loaded || !live) {
    return false;
  }

  return loaded !== live;
}
