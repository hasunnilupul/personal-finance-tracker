import { pgTable, timestamp, integer, varchar, numeric, index } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { categories } from "@/lib/db/schema/categories";

/**
 * A spending limit for one category over a recurring period.
 */
export const budgets = pgTable(
  "budgets",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("categoryId").references(() => categories.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    period: varchar("period", { length: 20 }).notNull(), // 'monthly', 'yearly'
    startDate: timestamp("startDate").notNull(),
    ...auditColumns(),
  },
  (table) => [
    index("budgets_organizationId_idx").on(table.organizationId),
    index("budgets_categoryId_idx").on(table.categoryId),
  ],
);
