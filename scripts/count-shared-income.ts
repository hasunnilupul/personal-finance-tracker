import "dotenv/config";

import { and, count, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { organization } from "@/lib/db/schema/organization";
import { income } from "@/lib/db/schema/income";
import { categories } from "@/lib/db/schema/categories";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";

/**
 * Counts what the shared-space income migration would destroy, before it runs.
 *
 * The migration deletes rather than migrates — that was the decision — and a
 * delete with no way back is not something to run on a guess about how much is
 * in there. This prints the cost first, per space, so the number is on the
 * record before anyone applies it.
 *
 * Read-only. Run it with `pnpm tsx ./scripts/count-shared-income.ts` against
 * whichever database `DATABASE_URL` points at, and run it again against
 * production before that release goes out — the two are separate databases and
 * only one of them holds anything anyone would miss.
 */
async function main() {
  const sharedSpaces = await db
    .select({ id: organization.id, name: organization.name })
    .from(organization)
    .where(eq(organization.isPersonal, false));

  if (sharedSpaces.length === 0) {
    console.log("No shared spaces. The migration has nothing to delete.");
    return;
  }

  const sharedIds = new Set(sharedSpaces.map((space) => space.id));

  const [entries, incomeCategories, templates] = await Promise.all([
    db
      .select({
        organizationId: income.organizationId,
        rows: count(),
        total: sql<string>`coalesce(sum(${income.baseAmount}), 0)::text`,
      })
      .from(income)
      .groupBy(income.organizationId),

    db
      .select({ organizationId: categories.organizationId, rows: count() })
      .from(categories)
      .where(eq(categories.type, "income"))
      .groupBy(categories.organizationId),

    db
      .select({ organizationId: recurringTransactions.organizationId, rows: count() })
      .from(recurringTransactions)
      .where(and(eq(recurringTransactions.type, "income")))
      .groupBy(recurringTransactions.organizationId),
  ]);

  const byId = <T extends { organizationId: string }>(rows: T[]) =>
    new Map(
      rows
        .filter((row) => sharedIds.has(row.organizationId))
        .map((row) => [row.organizationId, row]),
    );

  const entriesById = byId(entries);
  const categoriesById = byId(incomeCategories);
  const templatesById = byId(templates);

  let totalEntries = 0;

  for (const space of sharedSpaces) {
    const entry = entriesById.get(space.id);
    const rows = entry?.rows ?? 0;

    totalEntries += rows;

    console.log(
      `${space.name}: ${rows} income ${rows === 1 ? "entry" : "entries"}` +
        (entry ? ` totalling ${entry.total} in the space's base currency` : "") +
        `, ${categoriesById.get(space.id)?.rows ?? 0} income categories` +
        `, ${templatesById.get(space.id)?.rows ?? 0} income templates`,
    );
  }

  console.log(
    totalEntries === 0
      ? "\nNothing would be lost: no shared space holds an income entry."
      : `\n${totalEntries} income ${totalEntries === 1 ? "entry" : "entries"} would be deleted with no way back.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
