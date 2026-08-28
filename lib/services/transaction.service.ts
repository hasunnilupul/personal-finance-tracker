import { expenses } from "@/lib/db/schema/expenses";
import { income } from "@/lib/db/schema/income";
import {
  findTransactionPage,
  inPersonalLedger,
  inSpace,
  listTransactionAuthors,
  sumTransactions,
  TransactionScope,
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
import type { NotificationInput } from "@/lib/db/models/notification.model";
import { ServiceError } from "@/lib/services/errors";

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
  /**
   * Which rows a `kind` is read over, given whose page is being drawn.
   *
   * **Expenses in a personal space widen; nothing else does.** Money spent out
   * of a shared space still leaves the pocket of whoever spent it, so a
   * personal ledger reads its owner's expenses wherever they were filed. A
   * shared space reads only its own, because that is the joint account and
   * what somebody spent privately is none of it.
   *
   * Income never widens, and does not need to: it can only be recorded in a
   * personal space, so the two scopes would select the same rows anyway.
   * Asking for the space scope says which rows are expected rather than
   * relying on the wider one being empty.
   */
  private scopeFor(ctx: SpaceContext, kind: TransactionKind): TransactionScope {
    return ctx.isPersonal && kind === "expense"
      ? inPersonalLedger(ctx.userId)
      : inSpace(ctx.organizationId);
  }

  /**
   * Refuses to record income anywhere but a personal space.
   *
   * A shared space is a joint ledger of what a household *spends*; what each
   * member earns is their own, and splitting it across as many copies as
   * somebody happens to have spaces was how this app used to lose track of it.
   * The UI does not offer income in a shared space; this is the check that
   * holds when something else asks anyway.
   */
  private assertKindAllowed(ctx: SpaceContext, kind: TransactionKind): void {
    if (kind === "income" && !ctx.isPersonal) {
      throw new ServiceError(
        "FORBIDDEN",
        "Income is recorded in your personal space, not in a shared one.",
      );
    }
  }

  async list(
    ctx: SpaceContext,
    kind: TransactionKind,
    filters: TransactionFilters = {},
  ): Promise<TransactionPage> {
    return findTransactionPage(TABLES[kind], this.scopeFor(ctx, kind), filters);
  }

  /**
   * Total for the filtered set, in the reader's base currency.
   */
  async total(
    ctx: SpaceContext,
    kind: TransactionKind,
    filters: TransactionFilters = {},
  ): Promise<string> {
    return sumTransactions(TABLES[kind], this.scopeFor(ctx, kind), filters);
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
    this.assertKindAllowed(ctx, kind);

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
    this.assertKindAllowed(ctx, kind);

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

    const crossings = await budgetService.findCrossings(ctx, categoryId, date);

    for (const { budget, window, spent, level } of crossings) {
      const windowKey = window.start.toISOString().slice(0, 10);
      const limit = formatMoney(budget.amount, ctx.baseCurrency);

      const notice: Pick<NotificationInput, "type" | "title" | "body" | "dedupeKey"> =
        level === "exceeded"
          ? {
              type: "budget_overspend",
              title: `Over budget: ${window.label}`,
              body: `${formatMoney(spent, ctx.baseCurrency)} spent against a ${limit} limit — ${formatMoney((Number(spent) - Number(budget.amount)).toFixed(2), ctx.baseCurrency)} over.`,
              // **Unchanged on purpose.** Adding a suffix here would miss every
              // key already written this window and re-announce an overspend
              // people were told about days ago.
              dedupeKey: `budget:${budget.id}:${windowKey}`,
            }
          : {
              type: "budget_warning",
              title: `Nearing budget: ${window.label}`,
              body: `${formatMoney(spent, ctx.baseCurrency)} of a ${limit} limit — ${formatMoney((Number(budget.amount) - Number(spent)).toFixed(2), ctx.baseCurrency)} left.`,
              // **Its own key, and this is the load-bearing part.** Sharing the
              // breach's key would mean the warning claims it first and the
              // overspend notice is silently swallowed by the unique
              // constraint — so passing the limit would say nothing at all,
              // which is the one outcome worse than not warning.
              dedupeKey: `budget:${budget.id}:${windowKey}:warning`,
            };

      await notificationService.notifySpace(ctx.organizationId, {
        ...notice,
        href: "/budgets",
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
