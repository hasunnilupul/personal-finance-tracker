import { pgTable, timestamp, integer, varchar, numeric, boolean, index } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { categories } from "@/lib/db/schema/categories";

/**
 * A transaction template that repeats on a schedule, e.g. rent or a salary.
 *
 * `nextDate` is the next occurrence still to be materialised into a real
 * expense or income row.
 */
export const recurringTransactions = pgTable(
  "recurringTransactions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("categoryId").references(() => categories.id, { onDelete: "set null" }),
    type: varchar("type", { length: 10 }).notNull(), // 'expense' or 'income'
    amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
    description: varchar("description", { length: 255 }),
    frequency: varchar("frequency", { length: 20 }).notNull(), // 'daily', 'weekly', 'monthly', 'yearly'
    nextDate: timestamp("nextDate").notNull(),
    isActive: boolean("isActive").notNull().default(true),
    ...auditColumns(),
  },
  (table) => [
    index("recurringTransactions_organizationId_idx").on(table.organizationId),
    // Drives the "what is due?" sweep.
    index("recurringTransactions_nextDate_idx").on(table.nextDate),
  ],
);
