import path from "node:path";

/**
 * The suite's own account, and where its cookie jar is kept.
 *
 * **One stable account rather than one per run.** A fresh email each time would
 * leave a trail of dead users and personal spaces in the development database
 * that nothing ever cleans up. This signs up once and signs in forever after,
 * so the cost to the database is exactly one row.
 *
 * The address is on `.test`, which is reserved by RFC 2606 and can never be a
 * real mailbox — so this cannot collide with a person, and nothing it does can
 * send mail anywhere.
 */
export const E2E_EMAIL = "e2e@financeflow.test";

/**
 * Not a secret, and it must not be treated as one.
 *
 * It guards an account that exists only in a development database and holds
 * nothing but whatever the suite itself writes. Putting it in an environment
 * variable would imply otherwise and make the suite fail confusingly on a
 * machine that had not set it.
 */
export const E2E_PASSWORD = "e2e-smoke-password";

export const E2E_NAME = "Smoke Test";

/** Where `auth.setup.ts` leaves the signed-in cookies for the other tests. */
export const STORAGE_STATE = path.join(__dirname, ".auth", "state.json");

/** The key the splash gate writes, mirrored from `lib/pwa/splash.ts`. */
export const SPLASH_SESSION_KEY = "financeflow:splash-shown";
