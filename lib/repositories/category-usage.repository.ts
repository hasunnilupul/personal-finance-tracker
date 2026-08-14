import { and, count, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import type { BatchStatement } from "@/lib/db/batch";
import { expenses } from "@/lib/db/schema/expenses";
import { income } from "@/lib/db/schema/income";
import { budgets } from "@/lib/db/schema/budgets";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";
import { CategoryUsage } from "@/lib/db/models/category.model";

/**
 * The four tables that carry a `categoryId`.
 *
 * Kept as one list so a new referencing table is added in a single place —
 * missing one here would let a category be deleted out from under live rows.
 */
type ReferencingTable =
  typeof expenses | typeof income | typeof recurringTransactions | typeof budgets;

/** Usage for a category nothing references yet. */
export const EMPTY_USAGE: CategoryUsage = {
  expenses: 0,
  income: 0,
  recurring: 0,
  budgets: 0,
  reassignable: 0,
  destroyed: 0,
};

function toUsage(parts: Omit<CategoryUsage, "reassignable" | "destroyed">): CategoryUsage {
  return {
    ...parts,
    reassignable: parts.expenses + parts.income + parts.recurring,
    destroyed: parts.budgets,
  };
}

/**
 * Counts and moves the references pointing at a category.
 *
 * Separate from `CategoryRepository` because it reaches across four other
 * tables; keeping it here leaves the category repository a plain CRUD surface.
 */
export class CategoryUsageRepository {
  async count(categoryId: number, organizationId: string): Promise<CategoryUsage> {
    const [expenseCount, incomeCount, recurringCount, budgetCount] = await Promise.all([
      this.countIn(expenses, categoryId, organizationId),
      this.countIn(income, categoryId, organizationId),
      this.countIn(recurringTransactions, categoryId, organizationId),
      this.countIn(budgets, categoryId, organizationId),
    ]);

    return toUsage({
      expenses: expenseCount,
      income: incomeCount,
      recurring: recurringCount,
      budgets: budgetCount,
    });
  }

  /**
   * Usage for every category in a space, keyed by category id.
   *
   * Four grouped queries rather than four per category, so the manage screen
   * costs the same whether the space has five categories or fifty.
   */
  async countAll(organizationId: string): Promise<Map<number, CategoryUsage>> {
    const [expenseTotals, incomeTotals, recurringTotals, budgetTotals] = await Promise.all([
      this.countGrouped(expenses, organizationId),
      this.countGrouped(income, organizationId),
      this.countGrouped(recurringTransactions, organizationId),
      this.countGrouped(budgets, organizationId),
    ]);

    const usage = new Map<number, CategoryUsage>();

    const ids = new Set([
      ...expenseTotals.keys(),
      ...incomeTotals.keys(),
      ...recurringTotals.keys(),
      ...budgetTotals.keys(),
    ]);

    for (const id of ids) {
      usage.set(
        id,
        toUsage({
          expenses: expenseTotals.get(id) ?? 0,
          income: incomeTotals.get(id) ?? 0,
          recurring: recurringTotals.get(id) ?? 0,
          budgets: budgetTotals.get(id) ?? 0,
        }),
      );
    }

    return usage;
  }

  /**
   * Points every reference at another category — as statements, not as writes.
   *
   * Scoped by `organizationId` on both sides, so this cannot drag rows across
   * a space boundary. `updatedBy` is stamped for the same reason every other
   * write is — a reassignment edits real history and should say who did it.
   *
   * These are returned rather than executed so they can go into the same batch
   * as the delete that follows them. Moving the rows and removing the category
   * they came from is one decision; running it as independent statements meant
   * a failure part-way left rows moved and the category still standing.
   *
   * Each carries a `returning` clause, so the batch response says how many rows
   * each table actually moved — the authoritative count, as opposed to the
   * advisory one the manage screen renders.
   *
   * **Budgets are deliberately not here**, which is why this covers three of
   * the four referencing tables. A budget cascades when its category goes, and
   * the delete dialog says so — it is the part a reassignment cannot save.
   * Moving one instead would also collide with
   * `budgets_organizationId_categoryId_period_key` whenever the replacement
   * category already has a limit for the same period, which is the common case:
   * a category worth reassigning to is a category likely to have a budget.
   *
   * Sync on purpose — see {@link BatchStatement}.
   */
  reassignStatements(
    fromId: number,
    toId: number,
    organizationId: string,
    updatedBy: string,
  ): BatchStatement[] {
    return [expenses, income, recurringTransactions].map((table) =>
      this.reassignIn(table, fromId, toId, organizationId, updatedBy),
    );
  }

  private async countIn(
    table: ReferencingTable,
    categoryId: number,
    organizationId: string,
  ): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(table)
      .where(and(eq(table.categoryId, categoryId), eq(table.organizationId, organizationId)));

    return row?.value ?? 0;
  }

  private async countGrouped(
    table: ReferencingTable,
    organizationId: string,
  ): Promise<Map<number, number>> {
    const rows = await db
      .select({ categoryId: table.categoryId, value: count() })
      .from(table)
      .where(eq(table.organizationId, organizationId))
      .groupBy(table.categoryId);

    const totals = new Map<number, number>();

    for (const row of rows) {
      // Uncategorised rows group under null and belong to no category.
      if (row.categoryId !== null) {
        totals.set(row.categoryId, row.value);
      }
    }

    return totals;
  }

  private reassignIn(
    table: ReferencingTable,
    fromId: number,
    toId: number,
    organizationId: string,
    updatedBy: string,
  ): BatchStatement {
    return db
      .update(table)
      .set({ categoryId: toId, updatedBy })
      .where(and(eq(table.categoryId, fromId), eq(table.organizationId, organizationId)))
      .returning({ id: table.id });
  }
}

export const categoryUsageRepository = new CategoryUsageRepository();
