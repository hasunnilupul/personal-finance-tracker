import { pgTable, timestamp, integer, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { moneyColumns } from "@/lib/db/schema/money";
import { categories } from "@/lib/db/schema/categories";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";

/**
 * A single income entry in a space. Mirrors {@link expenses}.
 */
export const income = pgTable(
  "income",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("categoryId").references(() => categories.id, { onDelete: "set null" }),
    ...moneyColumns(),
    description: varchar("description", { length: 255 }),
    date: timestamp("date").notNull(),
    /** The template that produced this entry, if any. See {@link expenses}. */
    recurringId: integer("recurringId").references(() => recurringTransactions.id, {
      onDelete: "set null",
    }),
    ...auditColumns(),
  },
  (table) => [
    index("income_organizationId_date_idx").on(table.organizationId, table.date),
    index("income_categoryId_idx").on(table.categoryId),
    // Idempotency for materialisation — see the matching index on `expenses`.
    uniqueIndex("income_recurring_occurrence_key").on(
      table.organizationId,
      table.recurringId,
      table.date,
    ),
  ],
);
