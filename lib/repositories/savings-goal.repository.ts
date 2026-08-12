import { db } from "@/lib/db";
import { savingsGoals } from "@/lib/db/schema/savings-goals";
import { SavingsGoal, NewSavingsGoal } from "@/lib/db/models/savings-goal.model";
import { eq, and } from "drizzle-orm";

export class SavingsGoalRepository {
  async findAll(organizationId: string): Promise<SavingsGoal[]> {
    return db.select().from(savingsGoals).where(eq(savingsGoals.organizationId, organizationId));
  }

  async findById(id: number, organizationId: string): Promise<SavingsGoal | undefined> {
    const [result] = await db
      .select()
      .from(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.organizationId, organizationId)));
    return result;
  }

  async create(data: NewSavingsGoal): Promise<SavingsGoal> {
    const [result] = await db.insert(savingsGoals).values(data).returning();
    return result;
  }

  async update(
    id: number,
    organizationId: string,
    data: Partial<NewSavingsGoal>,
  ): Promise<SavingsGoal | undefined> {
    const [result] = await db
      .update(savingsGoals)
      .set(data)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.organizationId, organizationId)))
      .returning();
    return result;
  }

  async delete(id: number, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(savingsGoals)
      .where(and(eq(savingsGoals.id, id), eq(savingsGoals.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }
}

export const savingsGoalRepository = new SavingsGoalRepository();
