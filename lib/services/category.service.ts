import { categoryRepository } from "@/lib/repositories/category.repository";
import { EMPTY_USAGE, categoryUsageRepository } from "@/lib/repositories/category-usage.repository";
import { BatchStatement, rowsReturned, runBatch } from "@/lib/db/batch";
import { Category, CategoryInput, CategoryWithUsage } from "@/lib/db/models/category.model";
import { SpaceContext } from "@/lib/services/types";
import { ServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";
import {
  APP_DEFAULT_CATEGORIES,
  APP_DEFAULT_INCOME_CATEGORIES,
} from "@/constants/default-categories";

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

  /**
   * The one answer to "may this space file under this category id".
   *
   * Anything that writes a `categoryId` takes it from a client, and the foreign
   * key behind the column only enforces that the row **exists** — in any space.
   * So the ownership question has to be asked here, or an entry in one space
   * can point at another space's category and render its name to people who
   * were never in it.
   *
   * `null` is a legitimate answer, meaning uncategorised; the check is about
   * ids that claim to be something.
   *
   * @param type The side the caller files under. A category is refused when it
   *   belongs to the other one, which is the same rule the pickers follow.
   * @param options.mismatchMessage Overrides the wrong-type sentence for a
   *   caller that can say something more useful about its own context.
   */
  async assertUsable(
    ctx: SpaceContext,
    categoryId: number | null | undefined,
    type: "income" | "expense",
    options: { mismatchMessage?: string } = {},
  ): Promise<void> {
    if (categoryId === null || categoryId === undefined) {
      return;
    }

    const category = await categoryRepository.findById(categoryId, ctx.organizationId);

    if (!category) {
      throw new ServiceError("NOT_FOUND", "That category no longer exists.");
    }

    if (category.type !== type) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        options.mismatchMessage ?? `That category is for ${category.type}, not ${type}.`,
      );
    }
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
   * Every category in the space with what references it.
   *
   * The counts are advisory — they tell the manage screen what a delete would
   * cost. {@link deleteCategory} re-checks at write time, so a count that goes
   * stale between render and click cannot let a category be deleted out from
   * under live rows.
   */
  async listWithUsage(ctx: SpaceContext): Promise<CategoryWithUsage[]> {
    const [all, usage] = await Promise.all([
      categoryRepository.findAll(ctx.organizationId),
      categoryUsageRepository.countAll(ctx.organizationId),
    ]);

    return all.map((category) => ({
      ...category,
      usage: usage.get(category.id) ?? EMPTY_USAGE,
    }));
  }

  /**
   * Deletes a category, optionally moving everything that uses it first.
   *
   * Without a target, a category still in use is refused. The foreign keys
   * would not stop the delete — they would null the references and silently
   * de-categorise history, and for budgets they would cascade and destroy the
   * rows outright. Failing loudly lets the user decide.
   *
   * @param reassignToId Category to move references to. Must be in the same
   * space and of the same type, or the entries would end up filed under a
   * category the pickers never offer for them.
   *
   * @throws {ServiceError} `CATEGORY_IN_USE` when in use and no target given.
   * @throws {ServiceError} `NOT_FOUND` / `VALIDATION_FAILED` for a bad target.
   */
  async deleteCategory(
    ctx: SpaceContext,
    id: number,
    reassignToId?: number,
  ): Promise<{ deleted: boolean; moved: number }> {
    const category = await categoryRepository.findById(id, ctx.organizationId);

    if (!category) {
      throw new ServiceError("NOT_FOUND", "That category no longer exists.");
    }

    const usage = await categoryUsageRepository.count(id, ctx.organizationId);
    const inUse = usage.reassignable + usage.destroyed;

    // Everything that can refuse the delete is checked before a statement is
    // built, so the batch below is only ever opened on a decision already made.
    let reassignments: BatchStatement[] = [];

    if (reassignToId !== undefined) {
      if (reassignToId === id) {
        throw new ServiceError("VALIDATION_FAILED", "Pick a different category to move them to.");
      }

      const target = await categoryRepository.findById(reassignToId, ctx.organizationId);

      if (!target) {
        throw new ServiceError("NOT_FOUND", "That replacement category no longer exists.");
      }

      if (target.type !== category.type) {
        throw new ServiceError(
          "VALIDATION_FAILED",
          `Move ${category.type} entries to another ${category.type} category.`,
        );
      }

      reassignments = categoryUsageRepository.reassignStatements(
        id,
        reassignToId,
        ctx.organizationId,
        ctx.userId,
      );
    } else if (inUse > 0) {
      throw new ServiceError(
        "CATEGORY_IN_USE",
        `${inUse} ${inUse === 1 ? "record uses" : "records use"} this category. Choose one to move them to, or clear them first.`,
      );
    }

    // The reassignment and the delete are one decision, so they are one write.
    // Run separately, a failure between them left rows pointing at a category
    // that was supposed to be gone — or worse, moved off a category that then
    // survived. Either every row moves and the category goes, or nothing did.
    const results = await runBatch([
      ...reassignments,
      categoryRepository.deleteStatement(id, ctx.organizationId),
    ]);

    const deleteResult = results[results.length - 1];
    const moved = reassignments
      .map((_, index) => rowsReturned(results[index]))
      .reduce((total, rows) => total + rows, 0);

    const deleted = rowsReturned(deleteResult) > 0;

    logger.info("Category deleted", { organizationId: ctx.organizationId, id, moved });

    return { deleted, moved };
  }

  /**
   * Adds any default categories a space is missing for one type.
   *
   * Spaces created before income categories existed have none, and a picker
   * with nothing in it is a dead end. Existing names are left alone, so this
   * is safe to run more than once.
   *
   * @returns The categories actually created.
   */
  async addMissingDefaults(ctx: SpaceContext, type: "income" | "expense"): Promise<Category[]> {
    const existing = await categoryRepository.findByType(ctx.organizationId, type);
    const taken = new Set(existing.map((category) => category.name.toLowerCase()));

    const defaults = type === "expense" ? APP_DEFAULT_CATEGORIES : APP_DEFAULT_INCOME_CATEGORIES;

    const missing = defaults
      .filter((category) => !taken.has(category.name.toLowerCase()))
      .map((category) => ({
        ...category,
        type,
        organizationId: ctx.organizationId,
        createdBy: ctx.userId,
        updatedBy: ctx.userId,
      }));

    return categoryRepository.createMany(missing);
  }

  /**
   * Seeds a brand-new space with the default expense categories.
   *
   * Called when a space is created — both the personal space made at sign-up
   * and any shared space — so a member never starts with an empty picker.
   */
  async seedDefaultCategories(ctx: SpaceContext): Promise<Category[]> {
    const withOwnership = (
      category: { name: string; icon: string; color: string },
      type: string,
    ) => ({
      ...category,
      type,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    return categoryRepository.createMany([
      ...APP_DEFAULT_CATEGORIES.map((category) => withOwnership(category, "expense")),
      ...APP_DEFAULT_INCOME_CATEGORIES.map((category) => withOwnership(category, "income")),
    ]);
  }
}

export const categoryService = new CategoryService();
