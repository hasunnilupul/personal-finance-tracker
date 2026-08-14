import { and, asc, eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import type { BatchStatement } from "@/lib/db/batch";
import { budgets } from "@/lib/db/schema/budgets";
import { categories } from "@/lib/db/schema/categories";
import { Budget, NewBudget } from "@/lib/db/models/budget.model";

/**
 * A budget row with the category it limits, for the list.
 */
export interface BudgetWithCategory extends Budget {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export class BudgetRepository {
  async findAll(organizationId: string): Promise<Budget[]> {
    return db.select().from(budgets).where(eq(budgets.organizationId, organizationId));
  }

  /**
   * Every budget in the space with its category's name, icon and colour.
   *
   * A left join rather than an inner one: `categoryId` is nullable at the
   * database level, and a budget whose category vanished should still be
   * visible so it can be deleted, not disappear silently.
   */
  async findAllWithCategory(organizationId: string): Promise<BudgetWithCategory[]> {
    return db
      .select({
        id: budgets.id,
        categoryId: budgets.categoryId,
        amount: budgets.amount,
        period: budgets.period,
        startDate: budgets.startDate,
        organizationId: budgets.organizationId,
        createdBy: budgets.createdBy,
        updatedBy: budgets.updatedBy,
        createdAt: budgets.createdAt,
        updatedAt: budgets.updatedAt,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(budgets)
      .leftJoin(categories, eq(budgets.categoryId, categories.id))
      .where(eq(budgets.organizationId, organizationId))
      .orderBy(asc(categories.name), asc(budgets.id));
  }

  async findById(id: number, organizationId: string): Promise<Budget | undefined> {
    const [result] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.organizationId, organizationId)));
    return result;
  }

  /**
   * The existing limit for a category and period, if there is one.
   *
   * Backs the service's duplicate check, so the user gets "there is already a
   * monthly budget for Groceries" instead of a unique-constraint error.
   */
  async findByCategoryAndPeriod(
    organizationId: string,
    categoryId: number,
    period: string,
  ): Promise<Budget | undefined> {
    const [result] = await db
      .select()
      .from(budgets)
      .where(
        and(
          eq(budgets.organizationId, organizationId),
          eq(budgets.categoryId, categoryId),
          eq(budgets.period, period),
        ),
      );
    return result;
  }

  async create(data: NewBudget): Promise<Budget> {
    const [result] = await db.insert(budgets).values(data).returning();
    return result;
  }

  async update(
    id: number,
    organizationId: string,
    data: Partial<NewBudget>,
  ): Promise<Budget | undefined> {
    const [result] = await db
      .update(budgets)
      .set(data)
      .where(and(eq(budgets.id, id), eq(budgets.organizationId, organizationId)))
      .returning();
    return result;
  }

  async delete(id: number, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }

  /**
   * Re-expresses every limit in a new base currency, in one statement.
   *
   * The same inline-`VALUES` join the entries use, and for the same reason —
   * each limit converts to its own figure, so this would otherwise be one
   * `UPDATE` per budget. See `reconvertEntriesStatement` for the mechanics.
   *
   * Sync on purpose — see {@link BatchStatement}.
   */
  reconvertStatement(
    organizationId: string,
    updatedBy: string,
    amounts: { id: number; amount: string }[],
  ): BatchStatement | null {
    if (amounts.length === 0) {
      return null;
    }

    const [first, ...rest] = amounts;

    const values = sql.join(
      [
        sql`(${first.id}::integer, ${first.amount}::numeric)`,
        ...rest.map((row) => sql`(${row.id}, ${row.amount})`),
      ],
      sql`, `,
    );

    return db
      .update(budgets)
      .set({ amount: sql`v.amount`, updatedBy })
      .from(sql`(values ${values}) as v(id, amount)`)
      .where(and(eq(budgets.id, sql`v.id`), eq(budgets.organizationId, organizationId)));
  }
}

export const budgetRepository = new BudgetRepository();
