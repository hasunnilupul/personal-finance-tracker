import { pgTable, timestamp, integer, varchar, index } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { moneyColumns } from "@/lib/db/schema/money";
import { categories } from "@/lib/db/schema/categories";

/**
 * A single expense in a space.
 *
 * `categoryId` is nullable and `set null` on category deletion, so removing a
 * category never silently destroys spending history — the entries simply
 * become uncategorised. The service layer still refuses to delete a category
 * that is in use, making that a fallback rather than the normal path.
 */
export const expenses = pgTable(
  "expenses",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("categoryId").references(() => categories.id, { onDelete: "set null" }),
    ...moneyColumns(),
    description: varchar("description", { length: 255 }),
    date: timestamp("date").notNull(),
    ...auditColumns(),
  },
  (table) => [
    index("expenses_organizationId_date_idx").on(table.organizationId, table.date),
    index("expenses_categoryId_idx").on(table.categoryId),
  ],
);
