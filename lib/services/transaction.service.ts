import { expenses } from "@/lib/db/schema/expenses";
import { income } from "@/lib/db/schema/income";
import {
  findTransactionPage,
  listTransactionAuthors,
  sumTransactions,
  TransactionTable,
} from "@/lib/repositories/transaction-query";
import { budgetService } from "@/lib/services/budget.service";
import { categoryService } from "@/lib/services/category.service";
import { expenseService } from "@/lib/services/expense.service";
import { incomeService } from "@/lib/services/income.service";
import { notificationService } from "@/lib/services/notification.service";
import { formatMoney } from "@/lib/currency/format";
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

    const created =
      kind === "expense"
        ? await expenseService.createExpense(ctx, data, options)
        : await incomeService.createIncome(ctx, data, options);

    if (created) {
      await this.announceOverspend(ctx, kind, created.categoryId, created.date);
    }

    return created;
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

    const updated =
      kind === "expense"
        ? await expenseService.updateExpense(ctx, id, data)
        : await incomeService.updateIncome(ctx, id, data);

    if (updated) {
      await this.announceOverspend(ctx, kind, updated.categoryId, updated.date);
    }

    return updated;
  }

  /**
   * Raises a notification when an expense has just carried a budget past its
   * limit.
   *
   * Write-time rather than scheduled, because crossing a budget is *caused* by
   * a write: there is nothing to poll for, and this way it is noticed the
   * moment it happens rather than whenever someone next opens the app.
   *
   * Only the first expense of a period announces it. Every later one crosses
   * the same limit again, and the dedupe key — the budget and the window it
   * was crossed in — is what turns those into no-ops at the database rather
   * than a notification per purchase.
   *
   * Income is exempt: a limit is on spending.
   */
  private async announceOverspend(
    ctx: SpaceContext,
    kind: TransactionKind,
    categoryId: number | null,
    date: Date,
  ): Promise<void> {
    if (kind !== "expense" || categoryId === null) {
      return;
    }

    const exceeded = await budgetService.findExceeded(ctx, categoryId, date);

    for (const { budget, window, spent } of exceeded) {
      const over = (Number(spent) - Number(budget.amount)).toFixed(2);

      await notificationService.notifySpace(ctx.organizationId, {
        type: "budget_overspend",
        title: `Over budget: ${window.label}`,
        body: `${formatMoney(spent, ctx.baseCurrency)} spent against a ${formatMoney(budget.amount, ctx.baseCurrency)} limit — ${formatMoney(over, ctx.baseCurrency)} over.`,
        href: "/budgets",
        dedupeKey: `budget:${budget.id}:${window.start.toISOString().slice(0, 10)}`,
      });
    }
  }

  async remove(ctx: SpaceContext, kind: TransactionKind, id: number) {
    return kind === "expense"
      ? expenseService.deleteExpense(ctx, id)
      : incomeService.deleteIncome(ctx, id);
  }
}

export const transactionService = new TransactionService();
