import { categoryRepository } from "@/lib/repositories/category.repository";
import { expenseRepository } from "@/lib/repositories/expense.repository";
import { incomeRepository } from "@/lib/repositories/income.repository";
import { Category, CategoryInput } from "@/lib/db/models/category.model";
import { SpaceContext } from "@/lib/services/types";
import { ServiceError } from "@/lib/services/errors";
import { APP_DEFAULT_CATEGORIES } from "@/constants/default-categories";

export class CategoryService {
  async getAllCategories(ctx: SpaceContext): Promise<Category[]> {
    return categoryRepository.findAll(ctx.organizationId);
  }

  async getCategoriesByType(ctx: SpaceContext, type: "income" | "expense"): Promise<Category[]> {
    return categoryRepository.findByType(ctx.organizationId, type);
  }

  async getCategoryById(ctx: SpaceContext, id: number): Promise<Category | undefined> {
    return categoryRepository.findById(id, ctx.organizationId);
  }

  async createCategory(ctx: SpaceContext, data: CategoryInput): Promise<Category> {
    return categoryRepository.create({
      ...data,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  }

  async updateCategory(
    ctx: SpaceContext,
    id: number,
    data: Partial<CategoryInput>,
  ): Promise<Category | undefined> {
    return categoryRepository.update(id, ctx.organizationId, {
      ...data,
      updatedBy: ctx.userId,
    });
  }

  /**
   * Deletes a category, refusing while entries still reference it.
   *
   * The foreign key would merely null the reference out, which silently
   * de-categorises history. Failing loudly lets the user reassign first.
   *
   * @throws {ServiceError} `CATEGORY_IN_USE` when entries still reference it.
   */
  async deleteCategory(ctx: SpaceContext, id: number): Promise<boolean> {
    const [expenseCount, incomeCount] = await Promise.all([
      expenseRepository.countByCategory(id, ctx.organizationId),
      incomeRepository.countByCategory(id, ctx.organizationId),
    ]);

    const inUse = expenseCount + incomeCount;

    if (inUse > 0) {
      throw new ServiceError(
        "CATEGORY_IN_USE",
        `This category is used by ${inUse} ${inUse === 1 ? "entry" : "entries"}. Reassign them before deleting it.`,
      );
    }

    return categoryRepository.delete(id, ctx.organizationId);
  }

  /**
   * Seeds a brand-new space with the default expense categories.
   *
   * Called when a space is created — both the personal space made at sign-up
   * and any shared space — so a member never starts with an empty picker.
   */
  async seedDefaultCategories(ctx: SpaceContext): Promise<Category[]> {
    return categoryRepository.createMany(
      APP_DEFAULT_CATEGORIES.map((category) => ({
        ...category,
        type: "expense",
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      })),
    );
  }
}

export const categoryService = new CategoryService();
