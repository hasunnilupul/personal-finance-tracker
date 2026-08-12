"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { categoryService } from "@/lib/services/category.service";
import { isServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";

const CATEGORIES_PATH = "/settings/categories";

/**
 * Paths whose data depends on the category list.
 */
function revalidateCategoryViews() {
  revalidatePath(CATEGORIES_PATH);
  revalidatePath("/expenses");
  revalidatePath("/income");
  revalidatePath("/");
}

const categorySchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Give the category a name.")
    .max(50, "Keep the name under 50 characters."),
  // Emoji are multi-byte, so the column's 50 characters is the real limit
  // rather than a character count that looks generous.
  icon: z.string().trim().min(1, "Pick an icon.").max(50),
  color: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour."),
  type: z.enum(["expense", "income"]),
});

export interface CategoryFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");

    fieldErrors[key] ??= issue.message;
  }

  return fieldErrors;
}

function toUserMessage(error: unknown, fallback: string): string {
  if (isServiceError(error)) {
    return error.message;
  }

  // A unique index protects one name per type per space; surface that as
  // guidance rather than as a database error.
  if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
    return "A category with that name already exists.";
  }

  return fallback;
}

export async function createCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const parsed = categorySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    const { ctx } = await requirePermission({ category: ["create"] });

    await categoryService.createCategory(ctx, parsed.data);
  } catch (error) {
    logger.error("Failed to create category", error);

    return { error: toUserMessage(error, "Could not create that category.") };
  }

  revalidateCategoryViews();

  return { success: true };
}

export async function updateCategoryAction(
  _previous: CategoryFormState,
  formData: FormData,
): Promise<CategoryFormState> {
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { error: "That category could not be identified." };
  }

  const parsed = categorySchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    const { ctx } = await requirePermission({ category: ["update"] });

    // `type` is deliberately not updatable: switching an expense category to
    // income would strand every entry filed under it in a list that no longer
    // offers it.
    const { type: _type, ...changes } = parsed.data;

    const updated = await categoryService.updateCategory(ctx, id, changes);

    if (!updated) {
      return { error: "That category no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to update category", error, { id });

    return { error: toUserMessage(error, "Could not save that change.") };
  }

  revalidateCategoryViews();

  return { success: true };
}

/**
 * Result of an action invoked outside a form, where there is nothing to
 * re-render but a toast to show.
 */
export interface CategoryActionState {
  error?: string;
  success?: string;
}

/**
 * Deletes a category, first moving everything that uses it to `reassignToId`.
 *
 * Without a target the service refuses while the category is in use, so the
 * counts the dialog rendered from going stale cannot cost anyone their
 * history.
 */
export async function deleteCategoryAction(
  id: number,
  reassignToId?: number,
): Promise<CategoryActionState> {
  try {
    const { ctx } = await requirePermission({ category: ["delete"] });

    const { moved } = await categoryService.deleteCategory(ctx, id, reassignToId);

    revalidateCategoryViews();

    return {
      success: moved
        ? `Category deleted, ${moved} ${moved === 1 ? "record" : "records"} moved.`
        : "Category deleted.",
    };
  } catch (error) {
    logger.error("Failed to delete category", error, { id, reassignToId });

    return { error: toUserMessage(error, "Could not delete that category.") };
  }
}

export async function addDefaultCategoriesAction(
  type: "expense" | "income",
): Promise<CategoryActionState> {
  try {
    const { ctx } = await requirePermission({ category: ["create"] });

    const created = await categoryService.addMissingDefaults(ctx, type);

    revalidateCategoryViews();

    return {
      success: created.length
        ? `Added ${created.length} default ${type} ${created.length === 1 ? "category" : "categories"}.`
        : "Those defaults are already there.",
    };
  } catch (error) {
    logger.error("Failed to add default categories", error, { type });

    return { error: "Could not add the defaults." };
  }
}
