import { budgetRepository } from "@/lib/repositories/budget.repository";
import { Budget, BudgetInput } from "@/lib/db/models/budget.model";
import { SpaceContext } from "@/lib/services/types";

export class BudgetService {
  async getAllBudgets(ctx: SpaceContext): Promise<Budget[]> {
    return budgetRepository.findAll(ctx.organizationId);
  }

  async getBudgetById(ctx: SpaceContext, id: number): Promise<Budget | undefined> {
    return budgetRepository.findById(id, ctx.organizationId);
  }

  async createBudget(ctx: SpaceContext, data: BudgetInput): Promise<Budget> {
    return budgetRepository.create({
      ...data,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  }

  async updateBudget(
    ctx: SpaceContext,
    id: number,
    data: Partial<BudgetInput>,
  ): Promise<Budget | undefined> {
    return budgetRepository.update(id, ctx.organizationId, {
      ...data,
      updatedBy: ctx.userId,
    });
  }

  async deleteBudget(ctx: SpaceContext, id: number): Promise<boolean> {
    return budgetRepository.delete(id, ctx.organizationId);
  }
}

export const budgetService = new BudgetService();
