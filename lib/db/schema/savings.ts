import { pgTable, timestamp, integer, varchar, index, uniqueIndex } from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { moneyColumns } from "@/lib/db/schema/money";
import { categories } from "@/lib/db/schema/categories";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";

/**
 * `liquidity` values a saving may be tagged with.
 *
 * Informational only — both are deducted from a personal balance identically,
 * the same way an expense is. The split exists purely so a report can say how
 * much of what was set aside is still reachable versus put away for good: an
 * emergency fund (`liquid`) reads differently from an ongoing investment
 * contribution (`locked`).
 */
export const SAVINGS_LIQUIDITY_VALUES = ["liquid", "locked"] as const;
export type SavingsLiquidity = (typeof SAVINGS_LIQUIDITY_VALUES)[number];

/**
 * A single saving in a personal space. Mirrors {@link income}.
 *
 * **Real money, not a target.** Unlike a `savingsGoals` row — a target with
 * no money moving — a saving here is entered exactly like an expense and
 * deducted from the personal balance the same way. Spending liquid savings
 * back out is recorded as a saving with a negative `amount`, the same signed-
 * delta convention `savingsGoals` contributions already use, rather than a
 * separate withdrawal flow.
 *
 * `categoryId` is carried for structural parity with `expenses`/`income` —
 * every function in `transaction-query.ts` reads it directly off the shared
 * `TransactionTable` union — but the UI never offers a category picker for a
 * saving, so it is always `null` in practice.
 */
export const savings = pgTable(
  "savings",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    categoryId: integer("categoryId").references(() => categories.id, { onDelete: "set null" }),
    ...moneyColumns(),
    description: varchar("description", { length: 255 }),
    date: timestamp("date").notNull(),
    liquidity: varchar("liquidity", { length: 10 }).notNull().default("liquid"),
    /** The template that produced this entry, if any. See {@link expenses}. */
    recurringId: integer("recurringId").references(() => recurringTransactions.id, {
      onDelete: "set null",
    }),
    ...auditColumns(),
  },
  (table) => [
    index("savings_organizationId_date_idx").on(table.organizationId, table.date),
    // Idempotency for materialisation — see the matching index on `expenses`.
    uniqueIndex("savings_recurring_occurrence_key").on(
      table.organizationId,
      table.recurringId,
      table.date,
    ),
  ],
);
