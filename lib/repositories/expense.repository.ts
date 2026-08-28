import { db } from "@/lib/db";
import { expenses } from "@/lib/db/schema/expenses";
import { organization } from "@/lib/db/schema/organization";
import { Expense, NewExpense } from "@/lib/db/models/expense.model";
import { eq, and, desc } from "drizzle-orm";

/** The fields a re-conversion needs, and nothing else. */
export interface ConvertibleEntry {
  id: number;
  amount: string;
  currency: string;
  date: Date;
}

export class ExpenseRepository {
  /**
   * One person's expenses in the shared spaces they belong to.
   *
   * Read when their **personal** space changes its base currency: those rows
   * hold a second converted figure denominated in the currency being left
   * behind, and it lives in a space the switch does not otherwise touch. Left
   * alone, a personal ledger would go on adding its owner's shared spending in
   * the old currency and say nothing about it.
   *
   * Joined against `organization` rather than filtered on a list of space ids,
   * so the caller does not have to fetch the memberships first.
   */
  async findSharedByCreator(userId: string): Promise<ConvertibleEntry[]> {
    return db
      .select({
        id: expenses.id,
        amount: expenses.amount,
        currency: expenses.currency,
        date: expenses.date,
      })
      .from(expenses)
      .innerJoin(organization, eq(expenses.organizationId, organization.id))
      .where(and(eq(expenses.createdBy, userId), eq(organization.isPersonal, false)));
  }

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
