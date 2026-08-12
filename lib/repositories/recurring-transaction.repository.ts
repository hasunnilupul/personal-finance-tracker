import { db } from "@/lib/db";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";
import {
  RecurringTransaction,
  NewRecurringTransaction,
} from "@/lib/db/models/recurring-transaction.model";
import { eq, and } from "drizzle-orm";

export class RecurringTransactionRepository {
  async findAll(organizationId: string): Promise<RecurringTransaction[]> {
    return db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.organizationId, organizationId));
  }

  async findById(id: number, organizationId: string): Promise<RecurringTransaction | undefined> {
    const [result] = await db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.organizationId, organizationId),
        ),
      );
    return result;
  }

  async create(data: NewRecurringTransaction): Promise<RecurringTransaction> {
    const [result] = await db.insert(recurringTransactions).values(data).returning();
    return result;
  }

  async update(
    id: number,
    organizationId: string,
    data: Partial<NewRecurringTransaction>,
  ): Promise<RecurringTransaction | undefined> {
    const [result] = await db
      .update(recurringTransactions)
      .set(data)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.organizationId, organizationId),
        ),
      )
      .returning();
    return result;
  }

  async delete(id: number, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.id, id),
          eq(recurringTransactions.organizationId, organizationId),
        ),
      )
      .returning();
    return result.length > 0;
  }
}

export const recurringTransactionRepository = new RecurringTransactionRepository();
