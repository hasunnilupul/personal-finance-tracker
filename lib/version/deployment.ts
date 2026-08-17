/**
 * Which build is running.
 *
 * One value, read in two places that must agree: `next.config.ts` sets it as
 * Next's `deploymentId` at **build** time, and `/api/version` reports it at
 * **request** time. Both run inside the same deployment, so they see the same
 * environment and therefore the same id — that is what makes "the id my page
 * was served with" and "the id the server is on now" comparable at all.
 *
 * `next.config.ts` imports this **relatively**, not through the `@/` alias: the
 * config is loaded before the tsconfig paths apply. Everything inside the app
 * imports it the usual way.
 *
 * The chain, in order:
 *
 * - `NEXT_DEPLOYMENT_ID` is the variable Next itself reads for `deploymentId`,
 *   so setting it keeps the config and this function in step by construction.
 *   It is also the way to exercise any of this locally — `next build` has no
 *   deployment to be part of.
 * - `VERCEL_DEPLOYMENT_ID` is opaque and changes on every deployment, which is
 *   exactly the property wanted, and unlike the commit sha it says nothing
 *   about the repository.
 * - `VERCEL_GIT_COMMIT_SHA` and `VERCEL_URL` are fallbacks for a deployment
 *   where the first is somehow absent. Both change per deployment too.
 *
 * Undefined everywhere else, and that is a working state rather than a broken
 * one: with no id, `data-dpl-id` is never emitted, the endpoint reports null,
 * and the client watcher stays quiet instead of guessing.
 */
const ENV_KEYS = [
  "NEXT_DEPLOYMENT_ID",
  "VERCEL_DEPLOYMENT_ID",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_URL",
] as const;

export function deploymentId(): string | undefined {
  // Indexed with a variable, which is not decoration. A literal
  // `process.env.NEXT_DEPLOYMENT_ID` is **inlined into the server bundle at
  // build time**, while `next.config.ts` — where the same function decides
  // `data-dpl-id` — is re-read when the server boots. Bake one side and read
  // the other at runtime and the two disagree whenever the build environment
  // and the run environment do, which shows the update notice on a page that
  // is already current, forever. An indexed lookup cannot be inlined, so both
  // sides answer from the same place. Verified by building under one id and
  // starting under another.
  for (const key of ENV_KEYS) {
    const value = process.env[key];

    if (value) {
      return value;
    }
  }

  return undefined;
}
