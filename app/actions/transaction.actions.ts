"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requirePermission } from "@/lib/auth/dal";
import { transactionService } from "@/lib/services/transaction.service";
import { TransactionKind } from "@/lib/db/models/transaction.model";
import { isServiceError } from "@/lib/services/errors";
import { parseAmount } from "@/lib/currency/format";
import { SUPPORTED_CURRENCY_CODES } from "@/constants/currencies";
import { logger } from "@/lib/logger";

const PATHS: Record<TransactionKind, string> = {
  expense: "/expenses",
  income: "/income",
};

const kindSchema = z.enum(["expense", "income"]);

const transactionSchema = z.object({
  kind: kindSchema,
  // Amounts are typed by hand, so accept what people write ("Rs 1,200.50")
  // and normalise to the decimal string the column stores.
  amount: z.string().transform((value, ctx) => {
    const parsed = parseAmount(value);

    if (!parsed) {
      ctx.addIssue({ code: "custom", message: "Enter an amount greater than zero." });
      return z.NEVER;
    }

    return parsed;
  }),
  currency: z.enum(SUPPORTED_CURRENCY_CODES as [string, ...string[]]),
  date: z
    .string()
    .min(1, "Pick a date.")
    .transform((value, ctx) => {
      const parsed = new Date(`${value}T12:00:00.000Z`);

      if (Number.isNaN(parsed.getTime())) {
        ctx.addIssue({ code: "custom", message: "That date is not valid." });
        return z.NEVER;
      }

      return parsed;
    }),
  categoryId: z
    .string()
    .optional()
    .transform((value) => (value && value !== "none" ? Number(value) : null)),
  description: z
    .string()
    .trim()
    .max(255, "Keep the note under 255 characters.")
    .optional()
    .transform((value) => value || null),
});

export interface TransactionFormState {
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

  return fallback;
}

/**
 * Creates an expense or income entry.
 *
 * The amount is converted into the space's base currency by the service, using
 * the rate for the entry's own date — the client never supplies a converted
 * figure.
 */
export async function createTransactionAction(
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const { kind, ...data } = parsed.data;

  try {
    const { ctx } = await requirePermission({ transaction: ["create"] });

    await transactionService.create(ctx, kind, data);
  } catch (error) {
    logger.error("Failed to create transaction", error, { kind });

    return { error: toUserMessage(error, "Could not save that entry.") };
  }

  revalidatePath(PATHS[kind]);
  revalidatePath("/");

  return { success: true };
}

/**
 * Edits an entry. Any member of a shared space may edit any entry — the
 * attribution columns record who last touched it.
 */
export async function updateTransactionAction(
  _previous: TransactionFormState,
  formData: FormData,
): Promise<TransactionFormState> {
  const id = Number(formData.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return { error: "That entry could not be identified." };
  }

  const parsed = transactionSchema.safeParse(Object.fromEntries(formData));

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) };
  }

  const { kind, ...data } = parsed.data;

  try {
    const { ctx } = await requirePermission({ transaction: ["update"] });

    const updated = await transactionService.update(ctx, kind, id, data);

    if (!updated) {
      return { error: "That entry no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to update transaction", error, { kind, id });

    return { error: toUserMessage(error, "Could not save that change.") };
  }

  revalidatePath(PATHS[kind]);
  revalidatePath("/");

  return { success: true };
}

export interface DeleteState {
  error?: string;
  success?: string;
}

export async function deleteTransactionAction(
  kind: TransactionKind,
  id: number,
): Promise<DeleteState> {
  try {
    const { ctx } = await requirePermission({ transaction: ["delete"] });

    const removed = await transactionService.remove(ctx, kind, id);

    if (!removed) {
      return { error: "That entry no longer exists." };
    }
  } catch (error) {
    logger.error("Failed to delete transaction", error, { kind, id });

    return { error: toUserMessage(error, "Could not delete that entry.") };
  }

  revalidatePath(PATHS[kind]);
  revalidatePath("/");

  return { success: "Entry deleted." };
}
