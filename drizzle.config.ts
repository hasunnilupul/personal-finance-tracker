import "dotenv/config";
import { defineConfig } from "drizzle-kit";

/**
 * The host a connection string points at, with Neon's pooler marker removed.
 *
 * Neon's pooled host is the direct host with `-pooler` inserted before the
 * region, so stripping it makes the two comparable without connecting to
 * either. Returns `null` for anything that does not parse, so a connection
 * string in a format this does not understand disables the check rather than
 * blocking a migration.
 */
function endpointOf(url: string | undefined): string | null {
  if (!url) return null;

  try {
    return new URL(url).hostname.replace("-pooler", "");
  } catch {
    return null;
  }
}

/**
 * Refuses to migrate a different database than the app reads.
 *
 * `DATABASE_URL` and `DATABASE_URL_UNPOOLED` are two variables describing what
 * is meant to be one database — the pooled connection for the app, the direct
 * one for drizzle-kit. Nothing keeps them in step, and when they drifted apart
 * the failure was silent in the worst way: migrations applied cleanly, to a
 * database the app never opens, leaving the schema apparently up to date and
 * actually missing.
 *
 * Cheap to check and only ever wrong in one direction, so it throws rather than
 * warns — a migration is not something to run past a warning.
 */
const pooled = endpointOf(process.env.DATABASE_URL);
const direct = endpointOf(process.env.DATABASE_URL_UNPOOLED);

if (pooled && direct && pooled !== direct) {
  throw new Error(
    `DATABASE_URL and DATABASE_URL_UNPOOLED point at different databases:\n` +
      `  DATABASE_URL          -> ${pooled}\n` +
      `  DATABASE_URL_UNPOOLED -> ${direct}\n` +
      `Migrating would apply to the one the app does not read. They must be the ` +
      `pooled and direct connections of the same Neon endpoint.`,
  );
}

export default defineConfig({
  dialect: "postgresql",
  out: "./lib/db/migrations",
  schema: "./lib/db/schema/index.ts",
  dbCredentials: {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
