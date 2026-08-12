import { db } from "@/lib/db";
import { income } from "@/lib/db/schema/income";
import { Income, NewIncome } from "@/lib/db/models/income.model";
import { eq, and } from "drizzle-orm";

export class IncomeRepository {
  async findAll(userId: string): Promise<Income[]> {
    return db.select().from(income).where(eq(income.userId, userId));
  }

  async findById(id: number, userId: string): Promise<Income | undefined> {
    const [result] = await db
      .select()
      .from(income)
      .where(and(eq(income.id, id), eq(income.userId, userId)));
    return result;
  }

  async create(data: NewIncome): Promise<Income> {
    const [result] = await db.insert(income).values(data).returning();
    return result;
  }

  async update(id: number, userId: string, data: Partial<NewIncome>): Promise<Income | undefined> {
    const [result] = await db
      .update(income)
      .set(data)
      .where(and(eq(income.id, id), eq(income.userId, userId)))
      .returning();
    return result;
  }

  async delete(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(income)
      .where(and(eq(income.id, id), eq(income.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const incomeRepository = new IncomeRepository();
