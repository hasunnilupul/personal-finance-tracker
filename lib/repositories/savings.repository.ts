import { db } from "@/lib/db";
import { savings } from "@/lib/db/schema/savings";
import { Saving, NewSaving } from "@/lib/db/models/savings.model";
import { eq, and, desc } from "drizzle-orm";

export class SavingsRepository {
  async findAll(organizationId: string): Promise<Saving[]> {
    return db
      .select()
      .from(savings)
      .where(eq(savings.organizationId, organizationId))
      .orderBy(desc(savings.date), desc(savings.id));
  }

  async findById(id: number, organizationId: string): Promise<Saving | undefined> {
    const [result] = await db
      .select()
      .from(savings)
      .where(and(eq(savings.id, id), eq(savings.organizationId, organizationId)));
    return result;
  }

  async create(data: NewSaving): Promise<Saving> {
    const [result] = await db.insert(savings).values(data).returning();
    return result;
  }

  /**
   * Inserts an entry unless its occurrence already exists.
   * See {@link ExpenseRepository.createIfAbsent}.
   */
  async createIfAbsent(data: NewSaving): Promise<Saving | undefined> {
    const [result] = await db.insert(savings).values(data).onConflictDoNothing().returning();
    return result;
  }

  async update(
    id: number,
    organizationId: string,
    data: Partial<NewSaving>,
  ): Promise<Saving | undefined> {
    const [result] = await db
      .update(savings)
      .set(data)
      .where(and(eq(savings.id, id), eq(savings.organizationId, organizationId)))
      .returning();
    return result;
  }

  async delete(id: number, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(savings)
      .where(and(eq(savings.id, id), eq(savings.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }
}

export const savingsRepository = new SavingsRepository();
