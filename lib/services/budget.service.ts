import { budgetRepository } from "@/lib/repositories/budget.repository";
import { Budget, NewBudget } from "@/lib/db/models/budget.model";

export class BudgetService {
  async getAllBudgets(userId: string): Promise<Budget[]> {
    return budgetRepository.findAll(userId);
  }

  async getBudgetById(id: number, userId: string): Promise<Budget | undefined> {
    return budgetRepository.findById(id, userId);
  }

  async createBudget(data: NewBudget): Promise<Budget> {
    return budgetRepository.create(data);
  }

  async updateBudget(
    id: number,
    userId: string,
    data: Partial<NewBudget>,
  ): Promise<Budget | undefined> {
    return budgetRepository.update(id, userId, data);
  }

  async deleteBudget(id: number, userId: string): Promise<boolean> {
    return budgetRepository.delete(id, userId);
  }
}

export const budgetService = new BudgetService();
