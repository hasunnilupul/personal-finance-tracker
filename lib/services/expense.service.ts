import { expenseRepository } from "@/lib/repositories/expense.repository";
import { Expense, NewExpense } from "@/lib/db/models/expense.model";

export class ExpenseService {
  async getAllExpenses(userId: string): Promise<Expense[]> {
    return expenseRepository.findAll(userId);
  }

  async getExpenseById(id: number, userId: string): Promise<Expense | undefined> {
    return expenseRepository.findById(id, userId);
  }

  async createExpense(data: NewExpense): Promise<Expense> {
    return expenseRepository.create(data);
  }

  async updateExpense(
    id: number,
    userId: string,
    data: Partial<NewExpense>,
  ): Promise<Expense | undefined> {
    return expenseRepository.update(id, userId, data);
  }

  async deleteExpense(id: number, userId: string): Promise<boolean> {
    return expenseRepository.delete(id, userId);
  }
}

export const expenseService = new ExpenseService();
