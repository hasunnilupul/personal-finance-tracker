import { savingsGoalRepository } from "@/lib/repositories/savings-goal.repository";
import { SavingsGoal, NewSavingsGoal } from "@/lib/db/models/savings-goal.model";

export class SavingsGoalService {
  async getAllSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    return savingsGoalRepository.findAll(userId);
  }

  async getSavingsGoalById(id: number, userId: string): Promise<SavingsGoal | undefined> {
    return savingsGoalRepository.findById(id, userId);
  }

  async createSavingsGoal(data: NewSavingsGoal): Promise<SavingsGoal> {
    return savingsGoalRepository.create(data);
  }

  async updateSavingsGoal(
    id: number,
    userId: string,
    data: Partial<NewSavingsGoal>,
  ): Promise<SavingsGoal | undefined> {
    return savingsGoalRepository.update(id, userId, data);
  }

  async deleteSavingsGoal(id: number, userId: string): Promise<boolean> {
    return savingsGoalRepository.delete(id, userId);
  }
}

export const savingsGoalService = new SavingsGoalService();
