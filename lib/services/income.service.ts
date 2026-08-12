import { incomeRepository } from "@/lib/repositories/income.repository";
import { Income, IncomeInput } from "@/lib/db/models/income.model";
import { SpaceContext } from "@/lib/services/types";
import { exchangeRateService } from "@/lib/services/exchange-rate.service";
import { ServiceError } from "@/lib/services/errors";

export class IncomeService {
  async getAllIncome(ctx: SpaceContext): Promise<Income[]> {
    return incomeRepository.findAll(ctx.organizationId);
  }

  async getIncomeById(ctx: SpaceContext, id: number): Promise<Income | undefined> {
    return incomeRepository.findById(id, ctx.organizationId);
  }

  async createIncome(ctx: SpaceContext, data: IncomeInput): Promise<Income> {
    const currency = data.currency ?? ctx.baseCurrency;

    const { baseAmount, rate } = await exchangeRateService.convert(
      data.amount,
      currency,
      ctx.baseCurrency,
      data.date,
    );

    return incomeRepository.create({
      ...data,
      currency,
      baseAmount,
      exchangeRate: rate,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  }

  /**
   * Updates an income entry, re-converting when the amount, currency or date
   * changes — all three feed the stored base amount.
   */
  async updateIncome(
    ctx: SpaceContext,
    id: number,
    data: Partial<IncomeInput>,
  ): Promise<Income | undefined> {
    const affectsConversion =
      data.amount !== undefined || data.currency !== undefined || data.date !== undefined;

    if (!affectsConversion) {
      return incomeRepository.update(id, ctx.organizationId, {
        ...data,
        updatedBy: ctx.userId,
      });
    }

    const existing = await incomeRepository.findById(id, ctx.organizationId);

    if (!existing) {
      throw new ServiceError("NOT_FOUND", "That income entry no longer exists.");
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

    return incomeRepository.update(id, ctx.organizationId, {
      ...data,
      currency,
      baseAmount,
      exchangeRate: rate,
      updatedBy: ctx.userId,
    });
  }

  async deleteIncome(ctx: SpaceContext, id: number): Promise<boolean> {
    return incomeRepository.delete(id, ctx.organizationId);
  }
}

export const incomeService = new IncomeService();
