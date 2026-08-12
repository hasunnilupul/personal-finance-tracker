import { savingsGoalRepository } from "@/lib/repositories/savings-goal.repository";
import { SavingsGoal, SavingsGoalInput } from "@/lib/db/models/savings-goal.model";
import { SpaceContext } from "@/lib/services/types";

export class SavingsGoalService {
  async getAllSavingsGoals(ctx: SpaceContext): Promise<SavingsGoal[]> {
    return savingsGoalRepository.findAll(ctx.organizationId);
  }

  async getSavingsGoalById(ctx: SpaceContext, id: number): Promise<SavingsGoal | undefined> {
    return savingsGoalRepository.findById(id, ctx.organizationId);
  }

  async createSavingsGoal(ctx: SpaceContext, data: SavingsGoalInput): Promise<SavingsGoal> {
    return savingsGoalRepository.create({
      ...data,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  }

  async updateSavingsGoal(
    ctx: SpaceContext,
    id: number,
    data: Partial<SavingsGoalInput>,
  ): Promise<SavingsGoal | undefined> {
    return savingsGoalRepository.update(id, ctx.organizationId, {
      ...data,
      updatedBy: ctx.userId,
    });
  }

  async deleteSavingsGoal(ctx: SpaceContext, id: number): Promise<boolean> {
    return savingsGoalRepository.delete(id, ctx.organizationId);
  }
}

export const savingsGoalService = new SavingsGoalService();
