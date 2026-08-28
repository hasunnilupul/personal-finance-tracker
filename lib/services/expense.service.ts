import { expenseRepository } from "@/lib/repositories/expense.repository";
import { spaceRepository } from "@/lib/repositories/space.repository";
import { Expense, ExpenseInput } from "@/lib/db/models/expense.model";
import { SpaceContext } from "@/lib/services/types";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { ServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";

/** The second converted figure a shared-space expense carries. */
interface PersonalConversion {
  personalBaseAmount: string | null;
  personalExchangeRate: string | null;
}

const NOT_SHARED: PersonalConversion = {
  personalBaseAmount: null,
  personalExchangeRate: null,
};

export class ExpenseService {
  /**
   * What a shared-space expense is worth in its creator's own currency.
   *
   * An expense filed in a shared space is money out of one person's pocket, so
   * their personal ledger has to be able to add it up beside their own
   * spending. It cannot do that against `baseAmount`, which is denominated in
   * whatever the *shared* space reports in — so the figure is computed here,
   * at the same moment and against the same rate date as the other one, and
   * stored beside it.
   *
   * Computed on the write rather than on the read for the reason `baseAmount`
   * already is: a total is a single `sum()` either way, and converting on read
   * would mean a rate lookup per row of every list, month and report.
   *
   * Null in three cases, each of which the readers coalesce away:
   * - the expense is already in a personal space, where `baseAmount` is the
   *   figure the owner reads;
   * - the two spaces report in the same currency, so it would be a copy — the
   *   caller passes the conversion it already did rather than paying for a
   *   second identical lookup;
   * - the creator has no personal space at all, which means the sign-up hook
   *   failed for them. Worth a log rather than a refusal: the shared space's
   *   own figures are unaffected.
   *
   * A missing rate is **not** one of those cases. It throws, exactly as it does
   * for `baseAmount`, rather than writing a row whose personal figure is
   * quietly the wrong currency.
   */
  private async personalConversion(
    ctx: SpaceContext,
    amount: string,
    currency: string,
    date: Date,
    already: { baseAmount: string; rate: string },
  ): Promise<PersonalConversion> {
    if (ctx.isPersonal) {
      return NOT_SHARED;
    }

    const personal = await spaceRepository.findPersonalSpace(ctx.userId);

    if (!personal) {
      logger.warn("Shared expense recorded for a user with no personal space", {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
      });

      return NOT_SHARED;
    }

    if (personal.baseCurrency === ctx.baseCurrency) {
      return {
        personalBaseAmount: already.baseAmount,
        personalExchangeRate: already.rate,
      };
    }

    const { baseAmount, rate } = await exchangeRateService.convert(
      amount,
      currency,
      personal.baseCurrency,
      date,
    );

    return { personalBaseAmount: baseAmount, personalExchangeRate: rate };
  }

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

    const personal = await this.personalConversion(ctx, data.amount, currency, data.date, {
      baseAmount,
      rate,
    });

    const row = {
      ...data,
      currency,
      baseAmount,
      exchangeRate: rate,
      ...personal,
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

    // Recomputed from the edited values rather than left alone: the personal
    // figure is derived from the same three fields, so an edit that moves one
    // of them without moving this leaves the owner's ledger reporting the old
    // amount for an entry that has changed.
    const personal = await this.personalConversion(ctx, amount, currency, date, {
      baseAmount,
      rate,
    });

    return expenseRepository.update(id, ctx.organizationId, {
      ...data,
      currency,
      baseAmount,
      exchangeRate: rate,
      ...personal,
      updatedBy: ctx.userId,
    });
  }

  async deleteExpense(ctx: SpaceContext, id: number): Promise<boolean> {
    return expenseRepository.delete(id, ctx.organizationId);
  }
}

export const expenseService = new ExpenseService();
