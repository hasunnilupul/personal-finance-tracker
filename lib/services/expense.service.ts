import { expenseRepository } from "@/lib/repositories/expense.repository";
import { Expense, ExpenseInput } from "@/lib/db/models/expense.model";
import { SpaceContext } from "@/lib/services/types";

export class ExpenseService {
  async getAllExpenses(ctx: SpaceContext): Promise<Expense[]> {
    return expenseRepository.findAll(ctx.organizationId);
  }

  async getExpenseById(ctx: SpaceContext, id: number): Promise<Expense | undefined> {
    return expenseRepository.findById(id, ctx.organizationId);
  }

  async createExpense(ctx: SpaceContext, data: ExpenseInput): Promise<Expense> {
    return expenseRepository.create({
      ...data,
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
  }

  async updateExpense(
    ctx: SpaceContext,
    id: number,
    data: Partial<ExpenseInput>,
  ): Promise<Expense | undefined> {
    return expenseRepository.update(id, ctx.organizationId, {
      ...data,
      updatedBy: ctx.userId,
    });
  }

  async deleteExpense(ctx: SpaceContext, id: number): Promise<boolean> {
    return expenseRepository.delete(id, ctx.organizationId);
  }
}

export const expenseService = new ExpenseService();
