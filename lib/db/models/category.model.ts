import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { categories } from "@/lib/db/schema/categories";

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

/** Fields a caller may set; the service supplies the rest. */
export type CategoryInput = UserInput<NewCategory>;

/**
 * Everything that points at a category, and how it behaves when the category
 * is deleted.
 *
 * Expenses, income and recurring templates have their reference nulled — they
 * survive as uncategorised. **Budgets cascade**: deleting a category deletes
 * its budgets outright, because a spending limit for a category that no longer
 * exists means nothing. That difference is why budgets are counted separately
 * and called out in the UI rather than folded into one total.
 */
export interface CategoryUsage {
  expenses: number;
  income: number;
  recurring: number;
  budgets: number;
  /** References that would be reassigned, or nulled if the category went. */
  reassignable: number;
  /** References that would be destroyed with the category. */
  destroyed: number;
}

/** A category alongside what currently references it, for the manage screen. */
export type CategoryWithUsage = Category & { usage: CategoryUsage };
