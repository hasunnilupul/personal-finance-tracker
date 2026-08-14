"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { budgetService } from "@/lib/services/budget.service";
import { isServiceError } from "@/lib/services/errors";
import { parseAmount } from "@/lib/currency/format";
import { BUDGET_PERIODS } from "@/lib/db/models/budget.model";
import { logger } from "@/lib/logger";

const BUDGETS_PATH = "/budgets";

/**
 * Paths whose data depends on the budget list.
 *
 * The dashboard shows budget health, so it goes stale on any change here.
 */
function revalidateBudgetViews() {
  revalidatePath(BUDGETS_PATH);
  revalidatePath("/");
}

const budgetSchema = z.object({
  // Limits are typed by hand like any other amount, so the same parser applies:
  // "Rs 50,000" becomes the decimal string the column stores.
  amount: z.string().transform((value, ctx) => {
    const parsed = parseAmount(value);

    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Enter a limit greater than zero." });
      return z.NEVER;
    }

    return parsed;
  }),
  categoryId: z.string().transform((value, ctx) => {
    const parsed = Number(value);

    if (!Number.isInteger(parsed) || parsed <= 0) {
      ctx.addIssue({ code: "custom", message: "Pick a category." });
      return z.NEVER;
    }

    return parsed;
  }),
  period: z.enum(BUDGET_PERIODS),
});

export interface BudgetFormState {
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

  // The unique index is the backstop for two budgets on one category and
  // period; surface it as guidance rather than as a database error.
  if (error instanceof Error && /unique|duplicate/i.test(error.message)) {
    return "There is already a budget for that category and period.";
  }

  return fallback;
}

/**
 * Creates a budget, in effect from the current period onwards.
 *
 * The period it starts from is the service's to decide — accepting a start date
 * from the client would be a way to backdate a limit over spending that has
 * already happened.
 */
export async function createBudgetAction(
  _previous: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const parsed = budgetSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    const { ctx } = await requirePermission({ budget: ["create"] });

    await budgetService.createBudget(ctx, parsed.data);
  } catch (error) {
    logger.error("Failed to create budget", error);

    return { error: toUserMessage(error, "Could not create that budget.") };
  }

  revalidateBudgetViews();

  return { success: true };
}

export async function updateBudgetAction(
  _previous: BudgetFormState,
  formData: FormData,
): Promise<BudgetFormState> {
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { error: "That budget could not be identified." };
  }

  const parsed = budgetSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    const { ctx } = await requirePermission({ budget: ["update"] });

    const updated = await budgetService.updateBudget(ctx, id, parsed.data);

    if (!updated) {
      return { error: "That budget no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to update budget", error, { id });

    return { error: toUserMessage(error, "Could not save that change.") };
  }

  revalidateBudgetViews();

  return { success: true };
}

/**
 * Result of an action invoked outside a form, where there is nothing to
 * re-render but a toast to show.
 */
export interface BudgetActionState {
  error?: string;
  success?: string;
}

/**
 * Deletes a budget.
 *
 * Unlike deleting a category, this destroys nothing but the limit itself — the
 * spending it was measuring is untouched — so there is no reassignment to
 * offer.
 */
export async function deleteBudgetAction(id: number): Promise<BudgetActionState> {
  try {
    const { ctx } = await requirePermission({ budget: ["delete"] });

    const deleted = await budgetService.deleteBudget(ctx, id);

    if (!deleted) {
      return { error: "That budget no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to delete budget", error, { id });

    return { error: toUserMessage(error, "Could not delete that budget.") };
  }

  revalidateBudgetViews();

  return { success: "Budget deleted." };
}
