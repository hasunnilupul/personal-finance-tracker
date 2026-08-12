import { db } from "@/lib/db";
import { income } from "@/lib/db/schema/income";
import { Income, NewIncome } from "@/lib/db/models/income.model";
import { eq, and, desc } from "drizzle-orm";

export class IncomeRepository {
  async findAll(organizationId: string): Promise<Income[]> {
    return db
      .select()
      .from(income)
      .where(eq(income.organizationId, organizationId))
      .orderBy(desc(income.date), desc(income.id));
  }

  async findById(id: number, organizationId: string): Promise<Income | undefined> {
    const [result] = await db
      .select()
      .from(income)
      .where(and(eq(income.id, id), eq(income.organizationId, organizationId)));
    return result;
  }

  async create(data: NewIncome): Promise<Income> {
    const [result] = await db.insert(income).values(data).returning();
    return result;
  }

  async update(
    id: number,
    organizationId: string,
    data: Partial<NewIncome>,
  ): Promise<Income | undefined> {
    const [result] = await db
      .update(income)
      .set(data)
      .where(and(eq(income.id, id), eq(income.organizationId, organizationId)))
      .returning();
    return result;
  }

  async delete(id: number, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(income)
      .where(and(eq(income.id, id), eq(income.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }
}

export const incomeRepository = new IncomeRepository();
