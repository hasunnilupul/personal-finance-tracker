import { incomeRepository } from "@/lib/repositories/income.repository";
import { Income, NewIncome } from "@/lib/db/models/income.model";

export class IncomeService {
  async getAllIncome(userId: string): Promise<Income[]> {
    return incomeRepository.findAll(userId);
  }

  async getIncomeById(id: number, userId: string): Promise<Income | undefined> {
    return incomeRepository.findById(id, userId);
  }

  async createIncome(data: NewIncome): Promise<Income> {
    return incomeRepository.create(data);
  }

  async updateIncome(
    id: number,
    userId: string,
    data: Partial<NewIncome>,
  ): Promise<Income | undefined> {
    return incomeRepository.update(id, userId, data);
  }

  async deleteIncome(id: number, userId: string): Promise<boolean> {
    return incomeRepository.delete(id, userId);
  }
}

export const incomeService = new IncomeService();
