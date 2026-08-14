import { expenseRepository } from "@/lib/repositories/expense.repository";
import { Expense, ExpenseInput } from "@/lib/db/models/expense.model";
import { SpaceContext } from "@/lib/services/types";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { ServiceError } from "@/lib/services/errors";

export class ExpenseService {
  async getAllExpenses(ctx: SpaceContext): Promise<Expense[]> {
    return expenseRepository.findAll(ctx.organizationId);
  }

  async getExpenseById(ctx: SpaceContext, id: number): Promise<Expense | undefined> {
    return expenseRepository.findById(id, ctx.organizationId);
  }

  /**
   * Records an expense, converting it into the space's base currency.
   *
   * @param options Only the recurring machinery passes these. `recurringId`
   * marks the entry as generated, and `ifAbsent` makes the insert decline an
   * occurrence that already exists — together they are what let materialisation
   * be retried safely without an interactive transaction. Action handlers never
   * supply them; `ExpenseInput` deliberately cannot carry `recurringId`.
   *
   * @returns The new expense, or `undefined` when `ifAbsent` was set and the
   * occurrence was already there.
   */
  async createExpense(
    ctx: SpaceContext,
    data: ExpenseInput,
    options: { recurringId?: number; ifAbsent?: boolean } = {},
  ): Promise<Expense | undefined> {
    const currency = data.currency ?? ctx.baseCurrency;

    const { baseAmount, rate } = await exchangeRateService.convert(
      data.amount,
      currency,
      ctx.baseCurrency,
      data.date,
    );

    const row = {
      ...data,
      currency,
      baseAmount,
      exchangeRate: rate,
      recurringId: options.recurringId ?? null,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    return options.ifAbsent ? expenseRepository.createIfAbsent(row) : expenseRepository.create(row);
  }

  /**
   * Updates an expense, re-converting when anything the conversion depends on
   * changes.
   *
   * The amount, the currency and the date all feed the stored base amount, so
   * editing any of them without recomputing would leave a total that no longer
   * matches its parts.
   */
  async updateExpense(
    ctx: SpaceContext,
    id: number,
    data: Partial<ExpenseInput>,
  ): Promise<Expense | undefined> {
    const affectsConversion =
      data.amount !== undefined || data.currency !== undefined || data.date !== undefined;

    if (!affectsConversion) {
      return expenseRepository.update(id, ctx.organizationId, {
        ...data,
        updatedBy: ctx.userId,
      });
    }

    const existing = await expenseRepository.findById(id, ctx.organizationId);

    if (!existing) {
      throw new ServiceError("NOT_FOUND", "That expense no longer exists.");
    }

    const amount = data.amount ?? existing.amount;
    const currency = data.currency ?? existing.currency;
    const date = data.date ?? existing.date;

    const { baseAmount, rate } = await exchangeRateService.convert(
      amount,
      currency,
      ctx.baseCurrency,
      date,
    );

    return expenseRepository.update(id, ctx.organizationId, {
      ...data,
      currency,
      baseAmount,
      exchangeRate: rate,
      updatedBy: ctx.userId,
    });
  }

  async deleteExpense(ctx: SpaceContext, id: number): Promise<boolean> {
    return expenseRepository.delete(id, ctx.organizationId);
  }
}

export const expenseService = new ExpenseService();
