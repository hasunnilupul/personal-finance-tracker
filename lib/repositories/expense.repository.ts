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

  /** Number of expenses still pointing at a category, used before deleting it. */
  async countByCategory(categoryId: number, organizationId: string): Promise<number> {
    const result = await db
      .select({ id: expenses.id })
      .from(expenses)
      .where(and(eq(expenses.categoryId, categoryId), eq(expenses.organizationId, organizationId)));
    return result.length;
  }
}

export const expenseRepository = new ExpenseRepository();
