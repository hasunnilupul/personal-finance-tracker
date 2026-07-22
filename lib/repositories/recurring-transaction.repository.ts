import { db } from "@/lib/db";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";
import {
  RecurringTransaction,
  NewRecurringTransaction,
} from "@/lib/db/models/recurring-transaction.model";
import { eq, and } from "drizzle-orm";

export class RecurringTransactionRepository {
  async findAll(userId: string): Promise<RecurringTransaction[]> {
    return db.select().from(recurringTransactions).where(eq(recurringTransactions.userId, userId));
  }

  async findById(id: number, userId: string): Promise<RecurringTransaction | undefined> {
    const [result] = await db
      .select()
      .from(recurringTransactions)
      .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)));
    return result;
  }

  async create(data: NewRecurringTransaction): Promise<RecurringTransaction> {
    const [result] = await db.insert(recurringTransactions).values(data).returning();
    return result;
  }

  async update(
    id: number,
    userId: string,
    data: Partial<NewRecurringTransaction>,
  ): Promise<RecurringTransaction | undefined> {
    const [result] = await db
      .update(recurringTransactions)
      .set(data)
      .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)))
      .returning();
    return result;
  }

  async delete(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(recurringTransactions)
      .where(and(eq(recurringTransactions.id, id), eq(recurringTransactions.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const recurringTransactionRepository = new RecurringTransactionRepository();
