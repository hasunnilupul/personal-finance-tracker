import { db } from "@/lib/db";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";
import { categories } from "@/lib/db/schema/categories";
import {
  RecurringTransaction,
  NewRecurringTransaction,
} from "@/lib/db/models/recurring-transaction.model";
import { eq, and, asc, lte, count } from "drizzle-orm";

/**
 * A template with the category it files under, for the list.
 */
export interface RecurringWithCategory extends RecurringTransaction {
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export class RecurringTransactionRepository {
  async findAll(organizationId: string): Promise<RecurringTransaction[]> {
    return db
      .select()
      .from(recurringTransactions)
      .where(eq(recurringTransactions.organizationId, organizationId));
  }

  /**
   * Every template in the space, soonest-due first, with its category.
   *
   * A left join: `categoryId` is `set null` on category deletion, and a
   * template whose category vanished must stay visible so it can be fixed.
   */
  async findAllWithCategory(organizationId: string): Promise<RecurringWithCategory[]> {
    return db
      .select({
        id: recurringTransactions.id,
        categoryId: recurringTransactions.categoryId,
        type: recurringTransactions.type,
        amount: recurringTransactions.amount,
        currency: recurringTransactions.currency,
        description: recurringTransactions.description,
        frequency: recurringTransactions.frequency,
        startDate: recurringTransactions.startDate,
        nextDate: recurringTransactions.nextDate,
        endDate: recurringTransactions.endDate,
        isActive: recurringTransactions.isActive,
        organizationId: recurringTransactions.organizationId,
        createdBy: recurringTransactions.createdBy,
        updatedBy: recurringTransactions.updatedBy,
        createdAt: recurringTransactions.createdAt,
        updatedAt: recurringTransactions.updatedAt,
        categoryName: categories.name,
        categoryIcon: categories.icon,
        categoryColor: categories.color,
      })
      .from(recurringTransactions)
      .leftJoin(categories, eq(recurringTransactions.categoryId, categories.id))
      .where(eq(recurringTransactions.organizationId, organizationId))
      .orderBy(asc(recurringTransactions.nextDate), asc(recurringTransactions.id));
  }

  /**
   * Active templates in one space with an occurrence already due.
   *
   * Backed by the `nextDate` index, so the catch-up check on a page load costs
   * an index scan rather than a table read.
   */
  async findDue(organizationId: string, on: Date): Promise<RecurringTransaction[]> {
    return db
      .select()
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.organizationId, organizationId),
          eq(recurringTransactions.isActive, true),
          lte(recurringTransactions.nextDate, on),
        ),
      )
      .orderBy(asc(recurringTransactions.nextDate));
  }

  /**
   * How many templates in a space are due, without reading them.
   *
   * The catch-up guard on a page load: cheap enough to run every render, and
   * usually answers zero.
   */
  async countDue(organizationId: string, on: Date): Promise<number> {
    const [row] = await db
      .select({ value: count() })
      .from(recurringTransactions)
      .where(
        and(
          eq(recurringTransactions.organizationId, organizationId),
          eq(recurringTransactions.isActive, true),
          lte(recurringTransactions.nextDate, on),
        ),
      );

    return row?.value ?? 0;
  }

  /**
   * Every due template across every space, for the cron sweep.
   *
   * Deliberately not space-scoped — it is the one caller that runs without a
   * user, so the route handler that reaches it is the security boundary.
   */
  async findAllDue(on: Date): Promise<RecurringTransaction[]> {
    return db
      .select()
      .from(recurringTransactions)
      .where(and(eq(recurringTransactions.isActive, true), lte(recurringTransactions.nextDate, on)))
      .orderBy(asc(recurringTransactions.organizationId), asc(recurringTransactions.nextDate));
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
