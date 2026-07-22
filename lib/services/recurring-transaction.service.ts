import { recurringTransactionRepository } from "@/lib/repositories/recurring-transaction.repository";
import {
  RecurringTransaction,
  NewRecurringTransaction,
} from "@/lib/db/models/recurring-transaction.model";

export class RecurringTransactionService {
  async getAllRecurringTransactions(userId: string): Promise<RecurringTransaction[]> {
    return recurringTransactionRepository.findAll(userId);
  }

  async getRecurringTransactionById(
    id: number,
    userId: string,
  ): Promise<RecurringTransaction | undefined> {
    return recurringTransactionRepository.findById(id, userId);
  }

  async createRecurringTransaction(data: NewRecurringTransaction): Promise<RecurringTransaction> {
    return recurringTransactionRepository.create(data);
  }

  async updateRecurringTransaction(
    id: number,
    userId: string,
    data: Partial<NewRecurringTransaction>,
  ): Promise<RecurringTransaction | undefined> {
    return recurringTransactionRepository.update(id, userId, data);
  }

  async deleteRecurringTransaction(id: number, userId: string): Promise<boolean> {
    return recurringTransactionRepository.delete(id, userId);
  }
}

export const recurringTransactionService = new RecurringTransactionService();
