import { db } from "@/lib/db";
import { budgets } from "@/lib/db/schema/budgets";
import { Budget, NewBudget } from "@/lib/db/models/budget.model";
import { eq, and } from "drizzle-orm";

export class BudgetRepository {
  async findAll(userId: string): Promise<Budget[]> {
    return db.select().from(budgets).where(eq(budgets.userId, userId));
  }

  async findById(id: number, userId: string): Promise<Budget | undefined> {
    const [result] = await db
      .select()
      .from(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)));
    return result;
  }

  async create(data: NewBudget): Promise<Budget> {
    const [result] = await db.insert(budgets).values(data).returning();
    return result;
  }

  async update(id: number, userId: string, data: Partial<NewBudget>): Promise<Budget | undefined> {
    const [result] = await db
      .update(budgets)
      .set(data)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return result;
  }

  async delete(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(budgets)
      .where(and(eq(budgets.id, id), eq(budgets.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const budgetRepository = new BudgetRepository();
