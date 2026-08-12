import { pgTable, timestamp, integer, varchar, index } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { moneyColumns } from "@/lib/db/schema/money";
import { categories } from "@/lib/db/schema/categories";

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
    ...auditColumns(),
  },
  (table) => [
    index("income_organizationId_date_idx").on(table.organizationId, table.date),
    index("income_categoryId_idx").on(table.categoryId),
  ],
);
