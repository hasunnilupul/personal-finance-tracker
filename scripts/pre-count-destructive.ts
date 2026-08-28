import "dotenv/config";

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { neon } from "@neondatabase/serverless";

/**
 * Counts what a pending migration is about to destroy, and prints it.
 *
 * **The number a `DELETE` removes only exists before it runs.** The 2026-08-28
 * release shipped a migration that deleted every shared space's income; the PR
 * body and `PLAN.md` both asked for the count to be taken against production
 * first, nothing enforced it, and by the time anyone could have wanted the
 * figure it was unrecoverable. It happened to be zero. A request in prose is not
 * a control — this is, and it costs one `SELECT` per affected table on the
 * deploys that have one at all.
 *
 * It is spawned by `migrate-on-deploy.ts` immediately before `drizzle-kit
 * migrate`, so the output lands in the Vercel build log next to drizzle-kit's
 * own — which is already where the evidence that a migration ran lives. A child
 * process rather than a function call, because that script is a sequence of
 * top-level statements and **top-level `await` is not available here**: tsx
 * compiles to CJS and rejects it at runtime, while `tsc --noEmit` accepts it.
 * See the gotcha.
 *
 * **It never fails the deploy.** Everything here is diagnostic: a broken count
 * must not be the reason a release does not ship, and a migration that should be
 * stopped should be stopped by a human reading this, or by a check that says so
 * in as many words. Every path returns rather than throwing.
 */

const MIGRATIONS_DIR = join(process.cwd(), "lib", "db", "migrations");

/**
 * Statements worth counting before they run.
 *
 * Deliberately not "anything that changes data". An `UPDATE` is recoverable in
 * principle and a backfill is not news; these four are the ones that end things.
 * Each pattern captures the table name in group 1.
 *
 * The identifier is matched both quoted and bare, because a migration written
 * by hand does not always quote — and this file's whole purpose is to work on
 * the migration nobody thought about carefully.
 */
const DESTRUCTIVE: { label: string; pattern: RegExp }[] = [
  { label: "DELETE FROM", pattern: /\bDELETE\s+FROM\s+"?([A-Za-z_][A-Za-z0-9_]*)"?/gi },
  { label: "TRUNCATE", pattern: /\bTRUNCATE\s+(?:TABLE\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi },
  {
    label: "DROP TABLE",
    pattern: /\bDROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?"?([A-Za-z_][A-Za-z0-9_]*)"?/gi,
  },
  {
    label: "DROP COLUMN",
    pattern: /\bALTER\s+TABLE\s+"?([A-Za-z_][A-Za-z0-9_]*)"?[\s\S]*?\bDROP\s+COLUMN\b/gi,
  },
];

/** A table a pending migration would take rows out of, and why we think so. */
interface Threatened {
  table: string;
  reasons: Set<string>;
}

/**
 * Strips `--` comments before scanning.
 *
 * This repo's migrations carry long explanatory comments, and the 2026-08-28 one
 * has the words "DELETE FROM" inside a paragraph about what it deletes. Counting
 * a table named in prose would be harmless noise; missing a real statement
 * because a comment shifted the match would not be. Stripping first makes the
 * scan about SQL only.
 */
function withoutComments(sql: string): string {
  return sql
    .split("\n")
    .map((line) => {
      const marker = line.indexOf("--");

      return marker === -1 ? line : line.slice(0, marker);
    })
    .join("\n");
}

function scan(sql: string): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>();
  const body = withoutComments(sql);

  for (const { label, pattern } of DESTRUCTIVE) {
    // `lastIndex` persists on a /g regex between calls, so it is reset rather
    // than trusted — this runs the same patterns over many files.
    pattern.lastIndex = 0;

    let match: RegExpExecArray | null;

    while ((match = pattern.exec(body)) !== null) {
      const table = match[1];
      const reasons = found.get(table) ?? new Set<string>();

      reasons.add(label);
      found.set(table, reasons);
    }
  }

  return found;
}

/**
 * Reports what the pending migrations would destroy.
 *
 * @param connectionString The **direct** connection, the same one drizzle-kit
 * migrates over. Counting a different database than the one about to be changed
 * would be worse than not counting at all.
 */
export async function preCountDestructive(connectionString: string): Promise<void> {
  let names: string[];

  try {
    names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);

    console.warn(`Pre-count skipped: could not read the migrations folder — ${reason}`);

    return;
  }

  const sql = neon(connectionString);

  let applied: Set<string>;

  try {
    const rows = (await sql`
      select name from drizzle.__drizzle_migrations
    `) as { name: string }[];

    applied = new Set(rows.map((row) => row.name));
  } catch {
    // The table does not exist yet, which means this is the first migration
    // this database has ever seen — so there is nothing in it to lose, and the
    // absence is the answer rather than an error.
    console.log("Pre-count: no migration history in this database; nothing to count.");

    return;
  }

  const pending = names.filter((name) => !applied.has(name));

  if (pending.length === 0) {
    console.log("Pre-count: no pending migrations.");

    return;
  }

  console.log(`Pre-count: ${pending.length} pending migration(s): ${pending.join(", ")}`);

  const threatened = new Map<string, Threatened>();

  for (const name of pending) {
    let body: string;

    try {
      body = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8");
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);

      console.warn(`Pre-count: could not read ${name}/migration.sql — ${reason}`);

      continue;
    }

    for (const [table, reasons] of scan(body)) {
      const entry = threatened.get(table) ?? { table, reasons: new Set<string>() };

      for (const reason of reasons) {
        entry.reasons.add(reason);
      }

      threatened.set(table, entry);
    }
  }

  if (threatened.size === 0) {
    console.log("Pre-count: nothing destructive in them. No rows are at risk.");

    return;
  }

  console.log(
    `Pre-count: ${threatened.size} table(s) named by a destructive statement. ` +
      "Row counts BEFORE the migration runs:",
  );

  for (const { table, reasons } of threatened.values()) {
    const why = [...reasons].join(", ");

    try {
      // `sql.query` rather than the tagged template, because a table name
      // cannot be a bind parameter and so has to be part of the query text.
      // The identifier comes from this repo's own migration files rather than
      // from input, and `scan` only ever yields `[A-Za-z_][A-Za-z0-9_]*` — so
      // there is nothing here to quote out of.
      const rows = (await sql.query(`select count(*)::int as count from "${table}"`)) as {
        count: number;
      }[];

      const count = rows[0]?.count;

      console.log(`  ${table}: ${count ?? "?"} ${count === 1 ? "row" : "rows"}  (${why})`);
    } catch (error) {
      // A table the migration is about to CREATE and then delete from, or one
      // this connection cannot see. Not a reason to stop — and the message
      // alone, because a driver stack trace here would bury the numbers this
      // exists to print.
      const reason = error instanceof Error ? error.message : String(error);

      console.warn(`  ${table}: could not count — ${reason}  (${why})`);
    }
  }

  console.log(
    "Pre-count: those are the totals in each table, not the number the " +
      "statement matches — a WHERE clause narrows it. They are the upper bound, " +
      "and they are recorded here because after the migration they cannot be.",
  );
}

/**
 * Runnable on its own, so it can be pointed at a database by hand before a
 * risky migration rather than only from a deploy.
 *
 * **It always exits 0.** Spawned from the deploy, a non-zero status here would
 * be a diagnostic taking a release down — see the module comment. A caller that
 * wants the failure can read the warnings it prints.
 */
async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

  if (!connectionString) {
    console.warn(
      "Pre-count skipped: no DATABASE_URL_UNPOOLED or DATABASE_URL in this environment.",
    );

    return;
  }

  await preCountDestructive(connectionString);
}

main()
  .catch((error) => {
    console.warn("Pre-count skipped: it failed outright.", error);
  })
  .finally(() => process.exit(0));
