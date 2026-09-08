import { savingsRepository } from "@/lib/repositories/savings.repository";
import { Saving, SavingInput } from "@/lib/db/models/savings.model";
import { SpaceContext } from "@/lib/services/types";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { ServiceError } from "@/lib/services/errors";

export class SavingsService {
  async getAllSavings(ctx: SpaceContext): Promise<Saving[]> {
    return savingsRepository.findAll(ctx.organizationId);
  }

  async getSavingById(ctx: SpaceContext, id: number): Promise<Saving | undefined> {
    return savingsRepository.findById(id, ctx.organizationId);
  }

  /**
   * Records a saving, converting it into the space's base currency.
   *
   * Deducted from the personal balance exactly like an expense — the
   * `liquid`/`locked` split is informational only, read by the reports layer,
   * and defaults to `liquid` when the caller does not set it.
   *
   * @param options See {@link ExpenseService.createExpense} — only the
   * recurring machinery passes these.
   */
  async createSaving(
    ctx: SpaceContext,
    data: SavingInput,
    options: { recurringId?: number; ifAbsent?: boolean } = {},
  ): Promise<Saving | undefined> {
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
      liquidity: data.liquidity ?? "liquid",
      recurringId: options.recurringId ?? null,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    };

    return options.ifAbsent ? savingsRepository.createIfAbsent(row) : savingsRepository.create(row);
  }

  /**
   * Updates a saving, re-converting when the amount, currency or date
   * changes — all three feed the stored base amount.
   */
  async updateSaving(
    ctx: SpaceContext,
    id: number,
    data: Partial<SavingInput>,
  ): Promise<Saving | undefined> {
    const affectsConversion =
      data.amount !== undefined || data.currency !== undefined || data.date !== undefined;

    if (!affectsConversion) {
      return savingsRepository.update(id, ctx.organizationId, {
        ...data,
        updatedBy: ctx.userId,
      });
    }

    const existing = await savingsRepository.findById(id, ctx.organizationId);

    if (!existing) {
      throw new ServiceError("NOT_FOUND", "That saving no longer exists.");
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

    return savingsRepository.update(id, ctx.organizationId, {
      ...data,
      currency,
      baseAmount,
      exchangeRate: rate,
      updatedBy: ctx.userId,
    });
  }

  async deleteSaving(ctx: SpaceContext, id: number): Promise<boolean> {
    return savingsRepository.delete(id, ctx.organizationId);
  }
}

export const savingsService = new SavingsService();
