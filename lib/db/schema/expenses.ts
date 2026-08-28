import {
  pgTable,
  timestamp,
  integer,
  numeric,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { auditColumns } from "@/lib/db/schema/columns";
import { moneyColumns } from "@/lib/db/schema/money";
import { categories } from "@/lib/db/schema/categories";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";

/**
 * A single expense in a space.
 *
 * **An expense in a shared space is also spending out of somebody's own
 * pocket**, so it carries a second converted figure: `personalBaseAmount` is
 * the same money expressed in the base currency of `createdBy`'s personal
 * space. That is what lets a personal ledger add up its owner's shared
 * spending alongside their own without converting a row at a time on read —
 * the same reason `baseAmount` exists at all.
 *
 * Both are null for an expense recorded *in* a personal space, where
 * `baseAmount` is already in the right currency. Readers coalesce.
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
    /**
     * `amount` in the base currency of the creator's **personal** space.
     *
     * Null when the expense already lives in a personal space — there is no
     * second currency to hold — and null for a row whose creator has since
     * been deleted, since there is then no personal ledger to belong to.
     */
    personalBaseAmount: numeric("personalBaseAmount", { precision: 12, scale: 2 }),
    /** Rate used to get from `currency` to the personal base currency. */
    personalExchangeRate: numeric("personalExchangeRate", { precision: 20, scale: 10 }),
    /**
     * The template that produced this entry, if any.
     *
     * `set null` rather than cascade: deleting a template must not delete the
     * spending it already caused. The row simply stops pointing at it, and the
     * money stays in the history where it belongs.
     */
    recurringId: integer("recurringId").references(() => recurringTransactions.id, {
      onDelete: "set null",
    }),
    ...auditColumns(),
  },
  (table) => [
    index("expenses_organizationId_date_idx").on(table.organizationId, table.date),
    // What makes the personal ledger's cross-space read cheap: it asks for one
    // person's rows across every space they belong to, newest first.
    index("expenses_createdBy_date_idx").on(table.createdBy, table.date),
    index("expenses_categoryId_idx").on(table.categoryId),
    // What makes materialising a recurring transaction idempotent.
    //
    // The HTTP driver has no interactive transactions, so creating the entry
    // and advancing the template's `nextDate` cannot be one atomic step. A
    // failure between them would otherwise leave a duplicate on the next run.
    // With this in place the retry simply loses the insert and moves on, so
    // catch-up can run from a page load and a cron at the same time and still
    // produce one entry per occurrence.
    //
    // Nulls sort as distinct in Postgres, so hand-entered rows — which carry no
    // `recurringId` — are unaffected.
    uniqueIndex("expenses_recurring_occurrence_key").on(
      table.organizationId,
      table.recurringId,
      table.date,
    ),
  ],
);
