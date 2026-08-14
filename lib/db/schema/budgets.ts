import {
  pgTable,
  timestamp,
  integer,
  varchar,
  numeric,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { categories } from "@/lib/db/schema/categories";

/**
 * A spending limit for one category over a recurring period.
 *
 * Periods are **calendar-aligned** — see `lib/budgets/period.ts`. A row is a
 * standing limit, not one period's worth of it: nothing is materialised per
 * month, so `startDate` records the period the limit took effect and the window
 * being looked at supplies the rest.
 *
 * `amount` is in the space's **base currency**, which is why there is no
 * `currency` column here as there is on `expenses`. A limit is compared against
 * `baseAmount` sums, so holding it in anything else would mean converting one
 * side of every comparison. Changing a space's base currency re-converts these
 * along with the entries.
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
    // One limit per category per period. Two monthly budgets for Groceries
    // would leave the page with no answer to "am I over?", so the database
    // refuses the pair rather than trusting the service's check to win a race.
    // The service never writes a null `categoryId`, so nulls sorting as
    // distinct here does not open a gap.
    uniqueIndex("budgets_organizationId_categoryId_period_key").on(
      table.organizationId,
      table.categoryId,
      table.period,
    ),
  ],
);
