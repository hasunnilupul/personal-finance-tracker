"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { savingsGoalService, GOAL_PRIORITIES } from "@/lib/services/savings-goal.service";
import { isServiceError } from "@/lib/services/errors";
import { parseAmount } from "@/lib/currency/format";
import { logger } from "@/lib/logger";

const GOALS_PATH = "/goals";

function revalidateGoalViews() {
  revalidatePath(GOALS_PATH);
  revalidatePath("/");
}

const goalSchema = z.object({
  name: z.string().trim().min(1, "Give the goal a name.").max(100, "That name is too long."),
  targetAmount: z.string().transform((value, ctx) => {
    const parsed = parseAmount(value);

    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Enter a target greater than zero." });
      return z.NEVER;
    }

    return parsed;
  }),
  deadline: z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (!value) {
        return null;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        ctx.addIssue({ code: "custom", message: "Pick a real date." });
        return z.NEVER;
      }

      // Midday UTC, like every other date this app stores.
      return new Date(`${value}T12:00:00.000Z`);
    }),
  priority: z.enum(GOAL_PRIORITIES),
});

export interface GoalFormState {
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
  return isServiceError(error) ? error.message : fallback;
}

export async function createGoalAction(
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const parsed = goalSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    const { ctx } = await requirePermission({ savingsGoal: ["create"] });

    await savingsGoalService.create(ctx, parsed.data);
  } catch (error) {
    logger.error("Failed to create savings goal", error);

    return { error: toUserMessage(error, "Could not create that goal.") };
  }

  revalidateGoalViews();

  return { success: true };
}

export async function updateGoalAction(
  _previous: GoalFormState,
  formData: FormData,
): Promise<GoalFormState> {
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { error: "That goal could not be identified." };
  }

  const parsed = goalSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    const { ctx } = await requirePermission({ savingsGoal: ["update"] });

    const updated = await savingsGoalService.update(ctx, id, parsed.data);

    if (!updated) {
      return { error: "That goal no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to update savings goal", error, { id });

    return { error: toUserMessage(error, "Could not save that change.") };
  }

  revalidateGoalViews();

  return { success: true };
}

export interface GoalActionState {
  error?: string;
  success?: string;
}

export async function deleteGoalAction(id: number): Promise<GoalActionState> {
  try {
    const { ctx } = await requirePermission({ savingsGoal: ["delete"] });

    const deleted = await savingsGoalService.delete(ctx, id);

    if (!deleted) {
      return { error: "That goal no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to delete savings goal", error, { id });

    return { error: toUserMessage(error, "Could not delete that goal.") };
  }

  revalidateGoalViews();

  return { success: "Goal deleted." };
}

/**
 * Moves money into or out of a goal.
 *
 * A signed delta rather than a new balance, so two people paying into the same
 * household goal both count instead of overwriting each other.
 *
 * The amount is parsed with the shared `parseAmount`, which rejects anything
 * that is not a positive number; the direction comes from `withdraw` rather
 * than from a minus sign the parser would strip anyway.
 */
export async function contributeAction(
  id: number,
  amount: string,
  withdraw = false,
): Promise<GoalActionState> {
  const parsed = parseAmount(amount);

  if (!parsed) {
    return { error: "Enter an amount greater than zero." };
  }

  try {
    const { ctx } = await requirePermission({ savingsGoal: ["update"] });

    const updated = await savingsGoalService.contribute(ctx, id, withdraw ? `-${parsed}` : parsed);

    if (!updated) {
      return { error: "That goal no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to record a contribution", error, { id });

    return { error: toUserMessage(error, "Could not record that.") };
  }

  revalidateGoalViews();

  return { success: withdraw ? "Money taken out." : "Money added." };
}
