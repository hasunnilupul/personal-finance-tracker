import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { Expense, NewExpense } from "@/lib/db/models/expense.model";
import { eq, and } from "drizzle-orm";

export class ExpenseRepository {
  async findAll(userId: string): Promise<Expense[]> {
    return db.select().from(expenses).where(eq(expenses.userId, userId));
  }

  async findById(id: number, userId: string): Promise<Expense | undefined> {
    const [result] = await db
      .select()
      .from(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)));
    return result;
  }

  async create(data: NewExpense): Promise<Expense> {
    const [result] = await db.insert(expenses).values(data).returning();
    return result;
  }

  async update(
    id: number,
    userId: string,
    data: Partial<NewExpense>,
  ): Promise<Expense | undefined> {
    const [result] = await db
      .update(expenses)
      .set(data)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();
    return result;
  }

  async delete(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(expenses)
      .where(and(eq(expenses.id, id), eq(expenses.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const expenseRepository = new ExpenseRepository();
