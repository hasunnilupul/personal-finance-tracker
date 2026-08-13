import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { Expense, NewExpense } from "@/lib/db/models/expense.model";
import { eq, and, desc } from "drizzle-orm";

export class ExpenseRepository {
  async findAll(organizationId: string): Promise<Expense[]> {
    return db
      .select()
      .from(expenses)
      .where(eq(expenses.organizationId, organizationId))
      .orderBy(desc(expenses.date), desc(expenses.id));
  }

  async findById(id: number, organizationId: string): Promise<Expense | undefined> {
    const [result] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)));
    return result;
  }

  async create(data: NewExpense): Promise<Expense> {
    const [result] = await db.insert(expenses).values(data).returning();
    return result;
  }

  /**
   * Inserts an entry unless its occurrence already exists.
   *
   * The occurrence key is `(organizationId, recurringId, date)`, so this only
   * ever declines a row that a recurring template already produced — nulls sort
   * as distinct, leaving hand-entered rows alone.
   *
   * @returns The new row, or `undefined` when the occurrence was already there.
   */
  async createIfAbsent(data: NewExpense): Promise<Expense | undefined> {
    const [result] = await db.insert(expenses).values(data).onConflictDoNothing().returning();
    return result;
  }

  async update(
    id: number,
    organizationId: string,
    data: Partial<NewExpense>,
  ): Promise<Expense | undefined> {
    const [result] = await db
      .update(expenses)
      .set(data)
      .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)))
      .returning();
    return result;
  }

  async delete(id: number, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }
}

export const expenseRepository = new ExpenseRepository();
