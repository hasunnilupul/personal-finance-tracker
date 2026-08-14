import { expenses } from "@/lib/db/schema/expenses";
import { income } from "@/lib/db/schema/income";
import {
  findTransactionPage,
  listTransactionAuthors,
  sumTransactions,
  TransactionTable,
} from "@/lib/repositories/transaction-query";
import { categoryService } from "@/lib/services/category.service";
import { expenseService } from "@/lib/services/expense.service";
import { incomeService } from "@/lib/services/income.service";
import { SpaceContext } from "@/lib/services/types";
import {
  TransactionFilters,
  TransactionKind,
  TransactionPage,
} from "@/lib/db/models/transaction.model";

/**
 * What a caller may set on a transaction. Conversion fields are derived.
 */
export interface TransactionInput {
  amount: string;
  currency: string;
  date: Date;
  categoryId?: number | null;
  description?: string | null;
}

const TABLES: Record<TransactionKind, TransactionTable> = {
  expense: expenses,
  income,
};

/**
 * One entry point for both expenses and income.
 *
 * They behave identically, so the pages, the form and the actions work in
 * terms of a `kind` and this dispatches. The underlying per-entity services
 * still own the conversion and attribution rules.
 */
export class TransactionService {
  async list(
    ctx: SpaceContext,
    kind: TransactionKind,
    filters: TransactionFilters = {},
  ): Promise<TransactionPage> {
    return findTransactionPage(TABLES[kind], ctx.organizationId, filters);
  }

  /**
   * Total for the filtered set, in the space's base currency.
   */
  async total(
    ctx: SpaceContext,
    kind: TransactionKind,
    filters: TransactionFilters = {},
  ): Promise<string> {
    return sumTransactions(TABLES[kind], ctx.organizationId, filters);
  }

  async listAuthors(ctx: SpaceContext, kind: TransactionKind) {
    return listTransactionAuthors(TABLES[kind], ctx.organizationId);
  }

  /**
   * @param options Only the recurring machinery passes these — see
   * {@link ExpenseService.createExpense}.
   */
  async create(
    ctx: SpaceContext,
    kind: TransactionKind,
    data: TransactionInput,
    options: { recurringId?: number; ifAbsent?: boolean } = {},
  ) {
    // A materialised occurrence carries the template's own category, which was
    // checked when the template was saved and cannot have been deleted since —
    // `deleteCategory` refuses while a template still points at it. Re-checking
    // would be a query per generated entry, and a catch-up run writes up to
    // sixty of them inside one page render.
    if (options.recurringId === undefined) {
      await categoryService.assertUsable(ctx, data.categoryId, kind);
    }

    return kind === "expense"
      ? expenseService.createExpense(ctx, data, options)
      : incomeService.createIncome(ctx, data, options);
  }

  async update(
    ctx: SpaceContext,
    kind: TransactionKind,
    id: number,
    data: Partial<TransactionInput>,
  ) {
    // `undefined` means the edit does not touch the category; `null` means it
    // is being cleared. Neither needs a lookup, and `assertUsable` says so.
    await categoryService.assertUsable(ctx, data.categoryId, kind);

    return kind === "expense"
      ? expenseService.updateExpense(ctx, id, data)
      : incomeService.updateIncome(ctx, id, data);
  }

  async remove(ctx: SpaceContext, kind: TransactionKind, id: number) {
    return kind === "expense"
      ? expenseService.deleteExpense(ctx, id)
      : incomeService.deleteIncome(ctx, id);
  }
}

export const transactionService = new TransactionService();
