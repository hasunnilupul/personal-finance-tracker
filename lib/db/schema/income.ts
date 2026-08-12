import { pgTable, timestamp, integer, varchar, numeric, index } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { categories } from "@/lib/db/schema/categories";

/**
 * A single income entry in a space. Mirrors {@link expenses}.
 */
export const income = pgTable(
  "income",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("categoryId").references(() => categories.id, { onDelete: "set null" }),
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: varchar("description", { length: 255 }),
    date: timestamp("date").notNull(),
    ...auditColumns(),
  },
  (table) => [
    index("income_organizationId_date_idx").on(table.organizationId, table.date),
    index("income_categoryId_idx").on(table.categoryId),
  ],
);
