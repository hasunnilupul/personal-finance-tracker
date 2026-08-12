import { incomeRepository } from "@/lib/repositories/income.repository";
import { Income, IncomeInput } from "@/lib/db/models/income.model";
import { SpaceContext } from "@/lib/services/types";

export class IncomeService {
  async getAllIncome(ctx: SpaceContext): Promise<Income[]> {
    return incomeRepository.findAll(ctx.organizationId);
  }

  async getIncomeById(ctx: SpaceContext, id: number): Promise<Income | undefined> {
    return incomeRepository.findById(id, ctx.organizationId);
  }

  async createIncome(ctx: SpaceContext, data: IncomeInput): Promise<Income> {
    return incomeRepository.create({
      ...data,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  }

  async updateIncome(
    ctx: SpaceContext,
    id: number,
    data: Partial<IncomeInput>,
  ): Promise<Income | undefined> {
    return incomeRepository.update(id, ctx.organizationId, {
      ...data,
      updatedBy: ctx.userId,
    });
  }

  async deleteIncome(ctx: SpaceContext, id: number): Promise<boolean> {
    return incomeRepository.delete(id, ctx.organizationId);
  }
}

export const incomeService = new IncomeService();
