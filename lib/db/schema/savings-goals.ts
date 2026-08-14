import { pgTable, timestamp, integer, varchar, numeric, index } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";

/**
 * A savings target for a space, e.g. an emergency fund or a trip.
 */
export const savingsGoals = pgTable(
  "savingsGoals",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    name: varchar("name", { length: 100 }).notNull(),
    targetAmount: numeric("targetAmount", { precision: 12, scale: 2 }).notNull(),
    currentAmount: numeric("currentAmount", { precision: 12, scale: 2 }).notNull().default("0"),
    deadline: timestamp("deadline"),
    priority: varchar("priority", { length: 20 }).notNull().default("medium"), // 'low', 'medium', 'high'
    ...auditColumns(),
  },
  (table) => [index("savingsGoals_organizationId_idx").on(table.organizationId)],
);
