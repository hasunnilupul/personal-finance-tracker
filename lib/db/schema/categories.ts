import { pgTable, integer, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";

/**
 * Spending and earning categories, scoped to a space.
 *
 * Every new space is seeded with a default set, after which members can
 * add their own.
 */
export const categories = pgTable(
  "categories",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 50 }).notNull(),
    icon: varchar("icon", { length: 50 }).notNull(),
    color: varchar("color", { length: 7 }).notNull(),
    type: varchar("type", { length: 10 }).notNull(), // 'income' or 'expense'
    ...auditColumns(),
  },
  (table) => [
    index("categories_organizationId_idx").on(table.organizationId),
    // A space should not end up with two "Groceries" expense categories.
    uniqueIndex("categories_organizationId_name_type_uq").on(
      table.organizationId,
      table.name,
      table.type,
    ),
  ],
);
