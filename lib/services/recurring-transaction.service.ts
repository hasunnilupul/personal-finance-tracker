import { recurringTransactionRepository } from "@/lib/repositories/recurring-transaction.repository";
import {
  RecurringTransaction,
  RecurringTransactionInput,
} from "@/lib/db/models/recurring-transaction.model";
import { SpaceContext } from "@/lib/services/types";

export class RecurringTransactionService {
  async getAllRecurringTransactions(ctx: SpaceContext): Promise<RecurringTransaction[]> {
    return recurringTransactionRepository.findAll(ctx.organizationId);
  }

  async getRecurringTransactionById(
    ctx: SpaceContext,
    id: number,
  ): Promise<RecurringTransaction | undefined> {
    return recurringTransactionRepository.findById(id, ctx.organizationId);
  }

  async createRecurringTransaction(
    ctx: SpaceContext,
    data: RecurringTransactionInput,
  ): Promise<RecurringTransaction> {
    return recurringTransactionRepository.create({
      ...data,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  }

  async updateRecurringTransaction(
    ctx: SpaceContext,
    id: number,
    data: Partial<RecurringTransactionInput>,
  ): Promise<RecurringTransaction | undefined> {
    return recurringTransactionRepository.update(id, ctx.organizationId, {
      ...data,
      updatedBy: ctx.userId,
    });
  }

  async deleteRecurringTransaction(ctx: SpaceContext, id: number): Promise<boolean> {
    return recurringTransactionRepository.delete(id, ctx.organizationId);
  }
}

export const recurringTransactionService = new RecurringTransactionService();
