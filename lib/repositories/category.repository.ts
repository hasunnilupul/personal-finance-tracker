import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema/categories";
import { Category, NewCategory } from "@/lib/db/models/category.model";
import { eq, and } from "drizzle-orm";

export class CategoryRepository {
  async findAll(userId: string): Promise<Category[]> {
    return db.select().from(categories).where(eq(categories.userId, userId));
  }

  async findById(id: number, userId: string): Promise<Category | undefined> {
    const [result] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)));
    return result;
  }

  async create(data: NewCategory): Promise<Category> {
    const [result] = await db.insert(categories).values(data).returning();
    return result;
  }

  async update(
    id: number,
    userId: string,
    data: Partial<NewCategory>,
  ): Promise<Category | undefined> {
    const [result] = await db
      .update(categories)
      .set(data)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    return result;
  }

  async delete(id: number, userId: string): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.userId, userId)))
      .returning();
    return result.length > 0;
  }
}

export const categoryRepository = new CategoryRepository();
