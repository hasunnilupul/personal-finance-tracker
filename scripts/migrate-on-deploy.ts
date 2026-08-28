import "dotenv/config";

import { spawnSync } from "node:child_process";

/**
 * Applies pending migrations to the production database during its deploy.
 *
 * Production is the one database nobody migrates by hand. Development is
 * migrated by whoever is working on it, from their own `.env`, before the
 * change is ever committed — but nothing on the way to production opens the
 * production database at all, so merging to `main` used to ship code whose
 * schema had never been applied. The failure is silent in the same way the
 * split `DATABASE_URL` was: the build succeeds, the deploy goes live, and the
 * first query against a missing column is the first anyone hears of it.
 *
 * Running here rather than in a release checklist means it cannot be forgotten,
 * and a migration that fails takes the build down with it instead of promoting
 * a deployment the schema does not support.
 */

/**
 * Preview and development builds are skipped deliberately.
 *
 * Every branch other than `main` shares one development database with local
 * development. A preview build is not the owner of that database — migrating it
 * would apply one branch's schema underneath everyone else working against it,
 * including a developer mid-change on their own machine. Whoever writes the
 * migration runs it there, where they can see what it does.
 */
if (process.env.VERCEL_ENV !== "production") {
  console.log(
    `Skipping migrations: VERCEL_ENV is ${process.env.VERCEL_ENV ?? "unset"}, not "production".`,
  );
  process.exit(0);
}

/**
 * drizzle-kit migrates over the direct connection, not the pooled one, so a
 * production deployment needs both variables even though the app itself only
 * reads `DATABASE_URL`. Checking here names the missing variable; leaving it to
 * drizzle-kit produces a connection error that does not.
 */
if (!process.env.DATABASE_URL_UNPOOLED) {
  console.error(
    "DATABASE_URL_UNPOOLED is not set in this environment. drizzle-kit " +
      "migrates over the direct connection, so production needs it alongside " +
      "DATABASE_URL — the pooled and direct connections of the same endpoint.",
  );
  process.exit(1);
}

/**
 * Counts what the pending migrations would destroy, before they do.
 *
 * **A child process rather than an import, and not for tidiness.** This file is
 * a sequence of top-level statements, so calling an async function here needs
 * top-level `await` — which `tsc --noEmit` accepts and tsx rejects at runtime
 * with "Top-level await is currently not supported with the cjs output format".
 * The first version of this did exactly that and would have taken the deploy
 * down. See the gotcha.
 *
 * Synchronous, so the numbers land in the log above drizzle-kit's output rather
 * than interleaved with it. **Its exit status is deliberately ignored**: a
 * diagnostic must never be the reason a release does not ship, and the script
 * exits 0 regardless for the same reason.
 *
 * It reads the direct connection from the environment itself — the same one
 * drizzle-kit is about to migrate over, since a count taken against a different
 * database would be worse than no count at all.
 */
spawnSync("tsx", ["./scripts/pre-count-destructive.ts"], {
  stdio: "inherit",
  shell: true,
});

console.log("Applying migrations to the production database...");

/**
 * `drizzle.config.ts` refuses to run when the two connection strings address
 * different endpoints, and that check runs inside this child process — so a
 * production environment holding a mismatched pair fails the build rather than
 * migrating a database the deployment will not read.
 *
 * `shell: true` resolves `drizzle-kit` from `node_modules/.bin` on every
 * platform; without it Windows cannot execute the `.CMD` shim.
 */
const result = spawnSync("drizzle-kit", ["migrate"], {
  stdio: "inherit",
  shell: true,
});

if (result.error) {
  console.error("Could not run drizzle-kit:", result.error.message);
  process.exit(1);
}

if (result.status !== 0) {
  console.error(`Migration failed with exit code ${result.status}.`);
  process.exit(result.status ?? 1);
}

console.log("Migrations applied.");
