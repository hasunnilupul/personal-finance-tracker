"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { recurringTransactionService } from "@/lib/services/recurring-transaction.service";
import { isServiceError } from "@/lib/services/errors";
import { parseAmount } from "@/lib/currency/format";
import { FREQUENCIES } from "@/lib/recurring/schedule";
import { SUPPORTED_CURRENCY_CODES } from "@/constants/currencies";
import { logger } from "@/lib/logger";

const RECURRING_PATH = "/recurring";

/**
 * Paths whose data a template change can move.
 *
 * Materialising writes real entries, so the transaction lists, the dashboard
 * and the reports all go stale — not just this page.
 */
function revalidateAll() {
  revalidatePath(RECURRING_PATH);
  revalidatePath("/");
  revalidatePath("/expenses");
  revalidatePath("/income");
  revalidatePath("/reports");
}

/**
 * A calendar day from a date input, anchored to midday UTC.
 *
 * The same anchor every other date in this app uses — see the dates
 * convention. A midnight anchor would file an occurrence a day early for
 * anyone east of Greenwich.
 */
const daySchema = z.string().transform((value, ctx) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    ctx.addIssue({ code: "custom", message: "Pick a date." });
    return z.NEVER;
  }

  const parsed = new Date(`${value}T12:00:00.000Z`);

  if (Number.isNaN(parsed.getTime())) {
    ctx.addIssue({ code: "custom", message: "Pick a real date." });
    return z.NEVER;
  }

  return parsed;
});

const recurringSchema = z.object({
  type: z.enum(["expense", "income"]),
  amount: z.string().transform((value, ctx) => {
    const parsed = parseAmount(value);

    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Enter an amount greater than zero." });
      return z.NEVER;
    }

    return parsed;
  }),
  currency: z.enum(SUPPORTED_CURRENCY_CODES as unknown as [string, ...string[]]),
  categoryId: z
    .string()
    .optional()
    .transform((value) => {
      const parsed = Number(value);

      return value && Number.isInteger(parsed) && parsed > 0 ? parsed : null;
    }),
  description: z
    .string()
    .max(255)
    .optional()
    .transform((value) => value?.trim() || null),
  frequency: z.enum(FREQUENCIES),
  startDate: daySchema,
  endDate: z
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

      return new Date(`${value}T12:00:00.000Z`);
    }),
  isActive: z
    .string()
    .optional()
    .transform((value) => value !== "false"),
});

export interface RecurringFormState {
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

/**
 * Creates a template.
 *
 * A template dated in the past will materialise its history on the next
 * catch-up — which happens immediately, because the page that shows the result
 * runs one. `nextDate` is never accepted from the form: it is where the series
 * has got to, and moving it would let a client re-run or skip occurrences.
 */
export async function createRecurringAction(
  _previous: RecurringFormState,
  formData: FormData,
): Promise<RecurringFormState> {
  const parsed = recurringSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    const { ctx } = await requirePermission({ recurringTransaction: ["create"] });

    await recurringTransactionService.create(ctx, parsed.data);
    await recurringTransactionService.catchUp(ctx);
  } catch (error) {
    logger.error("Failed to create recurring template", error);

    return { error: toUserMessage(error, "Could not create that template.") };
  }

  revalidateAll();

  return { success: true };
}

export async function updateRecurringAction(
  _previous: RecurringFormState,
  formData: FormData,
): Promise<RecurringFormState> {
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { error: "That template could not be identified." };
  }

  const parsed = recurringSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  try {
    const { ctx } = await requirePermission({ recurringTransaction: ["update"] });

    const updated = await recurringTransactionService.update(ctx, id, parsed.data);

    if (!updated) {
      return { error: "That template no longer exists." };
    }

    await recurringTransactionService.catchUp(ctx);
  } catch (error) {
    logger.error("Failed to update recurring template", error, { id });

    return { error: toUserMessage(error, "Could not save that change.") };
  }

  revalidateAll();

  return { success: true };
}

export interface RecurringActionState {
  error?: string;
  success?: string;
}

/**
 * Deletes a template.
 *
 * The entries it already generated are kept — they are real money that was
 * really spent. They simply stop pointing at the template.
 */
export async function deleteRecurringAction(id: number): Promise<RecurringActionState> {
  try {
    const { ctx } = await requirePermission({ recurringTransaction: ["delete"] });

    const deleted = await recurringTransactionService.delete(ctx, id);

    if (!deleted) {
      return { error: "That template no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to delete recurring template", error, { id });

    return { error: toUserMessage(error, "Could not delete that template.") };
  }

  revalidateAll();

  return { success: "Template deleted. The entries it created were kept." };
}

/**
 * Pauses or resumes a template.
 *
 * Resuming runs a catch-up, so a template paused over a holiday fills in what
 * it missed rather than quietly losing those occurrences.
 */
export async function setRecurringActiveAction(
  id: number,
  isActive: boolean,
): Promise<RecurringActionState> {
  try {
    const { ctx } = await requirePermission({ recurringTransaction: ["update"] });

    const current = await recurringTransactionService.getById(ctx, id);

    if (!current) {
      return { error: "That template no longer exists." };
    }

    await recurringTransactionService.update(ctx, id, {
      type: current.type as "expense" | "income",
      amount: current.amount,
      currency: current.currency,
      categoryId: current.categoryId,
      description: current.description,
      frequency: current.frequency as (typeof FREQUENCIES)[number],
      startDate: current.startDate,
      endDate: current.endDate,
      isActive,
    });

    if (isActive) {
      await recurringTransactionService.catchUp(ctx);
    }
  } catch (error) {
    logger.error("Failed to change template state", error, { id });

    return { error: toUserMessage(error, "Could not change that template.") };
  }

  revalidateAll();

  return { success: isActive ? "Template resumed." : "Template paused." };
}

/**
 * Materialises anything due, on demand.
 *
 * The page already catches up on load, so this exists for the case where
 * someone wants to see it happen — and as the manual equivalent of the cron
 * sweep, which cannot run without `CRON_SECRET` configured.
 */
export async function runCatchUpAction(): Promise<RecurringActionState> {
  try {
    const { ctx } = await requirePermission({ recurringTransaction: ["update"] });

    const result = await recurringTransactionService.catchUp(ctx);

    revalidateAll();

    if (result.created === 0) {
      return { success: "Nothing was due." };
    }

    return {
      success: `${result.created} ${result.created === 1 ? "entry" : "entries"} added${
        result.more ? ", with more still to come" : ""
      }.`,
    };
  } catch (error) {
    logger.error("Failed to run catch-up", error);

    return { error: toUserMessage(error, "Could not run that.") };
  }
}
