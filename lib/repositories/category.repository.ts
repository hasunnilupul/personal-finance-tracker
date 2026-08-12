import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema/categories";
import { Category, NewCategory } from "@/lib/db/models/category.model";
import { eq, and, asc } from "drizzle-orm";

export class CategoryRepository {
  async findAll(organizationId: string): Promise<Category[]> {
    return db
      .select()
      .from(categories)
      .where(eq(categories.organizationId, organizationId))
      .orderBy(asc(categories.name));
  }

  async findByType(organizationId: string, type: string): Promise<Category[]> {
    return db
      .select()
      .from(categories)
      .where(and(eq(categories.organizationId, organizationId), eq(categories.type, type)))
      .orderBy(asc(categories.name));
  }

  async findById(id: number, organizationId: string): Promise<Category | undefined> {
    const [result] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)));
    return result;
  }

  async create(data: NewCategory): Promise<Category> {
    const [result] = await db.insert(categories).values(data).returning();
    return result;
  }

  async createMany(data: NewCategory[]): Promise<Category[]> {
    if (data.length === 0) {
      return [];
    }

    return db.insert(categories).values(data).returning();
  }

  async update(
    id: number,
    organizationId: string,
    data: Partial<NewCategory>,
  ): Promise<Category | undefined> {
    const [result] = await db
      .update(categories)
      .set(data)
      .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
      .returning();
    return result;
  }

  async delete(id: number, organizationId: string): Promise<boolean> {
    const result = await db
      .delete(categories)
      .where(and(eq(categories.id, id), eq(categories.organizationId, organizationId)))
      .returning();
    return result.length > 0;
  }
}

export const categoryRepository = new CategoryRepository();
