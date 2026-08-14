import { budgetRepository, BudgetWithCategory } from "@/lib/repositories/budget.repository";
import { categoryService } from "@/lib/services/category.service";
import { sumBaseAmountByCategory } from "@/lib/repositories/transaction-query";
import type { BatchStatement } from "@/lib/db/batch";
import { expenses } from "@/lib/db/schema/expenses";
import {
  Budget,
  BudgetedCategoryIds,
  BudgetPeriod,
  BudgetPeriodSummary,
  BudgetProgress,
  BudgetWithProgress,
  toBudgetState,
} from "@/lib/db/models/budget.model";
import {
  appliesTo,
  currentMonthKey,
  MonthKey,
  PeriodWindow,
  periodStartFor,
  windowFor,
} from "@/lib/budgets/period";
import { SpaceContext } from "@/lib/services/types";
import { ServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";

/**
 * What a caller may set on a budget.
 *
 * `startDate` is not among them: it is the period the limit takes effect from,
 * which the service derives from the clock. Letting a client pick it would be a
 * way to backdate a limit over spending that already happened.
 */
export interface BudgetFields {
  categoryId: number;
  amount: string;
  period: BudgetPeriod;
}

/** A limit the current period's spending has passed, and by how much. */
export interface ExceededBudget {
  budget: Budget;
  window: PeriodWindow;
  spent: string;
}

/**
 * One period type's budgets in one window, with the totals above them.
 */
export interface BudgetPeriodView {
  window: PeriodWindow;
  budgets: BudgetWithProgress[];
  summary: BudgetPeriodSummary;
}

/**
 * Both period types for the month being viewed.
 *
 * A monthly section for the month itself and a yearly one for the year that
 * contains it, so one set of navigation arrows drives both.
 *
 * `takenByPeriod` covers **every** budget in the space, not only the ones in
 * effect in this window: it exists to stop the form offering a category that
 * already has a limit, and a limit created after the month being viewed would
 * still clash on save.
 */
export interface BudgetOverview {
  monthly: BudgetPeriodView;
  yearly: BudgetPeriodView;
  takenByPeriod: BudgetedCategoryIds;
}

/**
 * Spend against a limit.
 *
 * Both figures are decimal strings from `numeric` columns; the subtraction goes
 * through `Number` because a 12,2 amount is exactly representable as a double
 * and the result is rounded once, at the end.
 */
function toProgress(amount: string, spent: string): BudgetProgress {
  const limit = Number(amount);
  const used = Number(spent);

  return {
    spent: used.toFixed(2),
    remaining: (limit - used).toFixed(2),
    ratio: limit > 0 ? used / limit : 0,
    state: toBudgetState(limit, used),
  };
}

/**
 * Categories that already hold a budget for a period, in the whole space.
 */
function takenCategoryIds(all: BudgetWithCategory[], period: BudgetPeriod): number[] {
  return all
    .filter((budget) => budget.period === period)
    .map((budget) => budget.categoryId)
    .filter((id): id is number => id !== null);
}

function summarise(budgets: BudgetWithProgress[]): BudgetPeriodSummary {
  let budgeted = 0;
  let spent = 0;
  let overCount = 0;

  for (const budget of budgets) {
    budgeted += Number(budget.amount);
    spent += Number(budget.spent);

    if (budget.state === "over") {
      overCount += 1;
    }
  }

  return { budgeted: budgeted.toFixed(2), spent: spent.toFixed(2), overCount };
}

export class BudgetService {
  async getAllBudgets(ctx: SpaceContext): Promise<Budget[]> {
    return budgetRepository.findAll(ctx.organizationId);
  }

  async getBudgetById(ctx: SpaceContext, id: number): Promise<Budget | undefined> {
    return budgetRepository.findById(id, ctx.organizationId);
  }

  /**
   * Every budget that was in effect in the given month, and in the year around
   * it, with what has been spent against each.
   *
   * Two grouped spend queries in total — one per window — rather than one per
   * budget. Periods are calendar-aligned, so every monthly budget shares a
   * window and can read its spend out of the same result.
   *
   * Budgets that started after the window are left out: showing next month's
   * limit against this month's spending would be a figure about nothing.
   */
  async getOverview(ctx: SpaceContext, month: MonthKey): Promise<BudgetOverview> {
    const monthly = windowFor("monthly", month);
    const yearly = windowFor("yearly", month);

    const [all, monthlySpend, yearlySpend] = await Promise.all([
      budgetRepository.findAllWithCategory(ctx.organizationId),
      sumBaseAmountByCategory(expenses, ctx.organizationId, monthly.start, monthly.end),
      sumBaseAmountByCategory(expenses, ctx.organizationId, yearly.start, yearly.end),
    ]);

    return {
      monthly: this.toView(all, monthly, monthlySpend),
      yearly: this.toView(all, yearly, yearlySpend),
      takenByPeriod: {
        monthly: takenCategoryIds(all, "monthly"),
        yearly: takenCategoryIds(all, "yearly"),
      },
    };
  }

  private toView(
    all: BudgetWithCategory[],
    window: PeriodWindow,
    spendByCategory: Map<number, string>,
  ): BudgetPeriodView {
    const budgets = all
      .filter((budget) => budget.period === window.period && appliesTo(budget.startDate, window))
      .map((budget) => {
        const spent =
          budget.categoryId === null ? "0" : (spendByCategory.get(budget.categoryId) ?? "0");

        return {
          id: budget.id,
          categoryId: budget.categoryId,
          categoryName: budget.categoryName,
          categoryIcon: budget.categoryIcon,
          categoryColor: budget.categoryColor,
          amount: budget.amount,
          period: window.period,
          startDate: budget.startDate,
          ...toProgress(budget.amount, spent),
        };
      });

    return { window, budgets, summary: summarise(budgets) };
  }

  /**
   * Which of a category's limits the given date's period has now exceeded.
   *
   * Runs after an expense is written, to answer "did that put us over?". The
   * category usually has no budget at all, which costs one query and stops
   * there; only when a limit exists is the spend for its window summed.
   *
   * The arithmetic is `sumBaseAmountByCategory` and `windowFor` — the same two
   * the budgets page reads through `getOverview`. A second way to decide what
   * "over" means would eventually disagree with the bar on screen, which for a
   * notification saying you overspent would be worse than saying nothing.
   */
  async findExceeded(ctx: SpaceContext, categoryId: number, on: Date): Promise<ExceededBudget[]> {
    const standing = await budgetRepository.findByCategory(ctx.organizationId, categoryId);

    if (standing.length === 0) {
      return [];
    }

    const month = currentMonthKey(on);
    const exceeded: ExceededBudget[] = [];

    for (const budget of standing) {
      const window = windowFor(budget.period as BudgetPeriod, month);

      // A limit only applies from its own period onwards, exactly as the
      // budgets page treats it.
      if (!appliesTo(budget.startDate, window)) {
        continue;
      }

      const spendByCategory = await sumBaseAmountByCategory(
        expenses,
        ctx.organizationId,
        window.start,
        window.end,
      );
      const spent = spendByCategory.get(categoryId) ?? "0";

      if (Number(spent) > Number(budget.amount)) {
        exceeded.push({ budget, window, spent: Number(spent).toFixed(2) });
      }
    }

    return exceeded;
  }

  /**
   * Creates a budget, starting from the current period.
   *
   * @throws {ServiceError} `VALIDATION_FAILED` for a category that is not an
   * expense category in this space, or when a limit for that pair already
   * exists.
   */
  async createBudget(ctx: SpaceContext, fields: BudgetFields): Promise<Budget> {
    await this.assertUsableCategory(ctx, fields.categoryId);

    const existing = await budgetRepository.findByCategoryAndPeriod(
      ctx.organizationId,
      fields.categoryId,
      fields.period,
    );

    if (existing) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        `There is already a ${fields.period} budget for that category. Edit it instead.`,
      );
    }

    const created = await budgetRepository.create({
      categoryId: fields.categoryId,
      amount: fields.amount,
      period: fields.period,
      startDate: periodStartFor(fields.period),
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    logger.info("Budget created", {
      organizationId: ctx.organizationId,
      id: created.id,
      period: fields.period,
    });

    return created;
  }

  /**
   * Edits a budget's limit, category or period.
   *
   * Moving a budget to another category or period re-checks for a clash, and
   * re-anchors `startDate` when the period changes — a monthly limit turned
   * yearly needs the start of the year, not the start of the month it was
   * created in, or it would be excluded from its own first year.
   *
   * @throws {ServiceError} `VALIDATION_FAILED` on a clash or an unusable
   * category.
   */
  async updateBudget(
    ctx: SpaceContext,
    id: number,
    fields: BudgetFields,
  ): Promise<Budget | undefined> {
    const current = await budgetRepository.findById(id, ctx.organizationId);

    if (!current) {
      return undefined;
    }

    await this.assertUsableCategory(ctx, fields.categoryId);

    const moved = current.categoryId !== fields.categoryId || current.period !== fields.period;

    if (moved) {
      const clash = await budgetRepository.findByCategoryAndPeriod(
        ctx.organizationId,
        fields.categoryId,
        fields.period,
      );

      if (clash && clash.id !== id) {
        throw new ServiceError(
          "VALIDATION_FAILED",
          `There is already a ${fields.period} budget for that category.`,
        );
      }
    }

    const periodChanged = current.period !== fields.period;

    return budgetRepository.update(id, ctx.organizationId, {
      categoryId: fields.categoryId,
      amount: fields.amount,
      period: fields.period,
      ...(periodChanged ? { startDate: periodStartFor(fields.period, current.startDate) } : {}),
      updatedBy: ctx.userId,
    });
  }

  async deleteBudget(ctx: SpaceContext, id: number): Promise<boolean> {
    const deleted = await budgetRepository.delete(id, ctx.organizationId);

    if (deleted) {
      logger.info("Budget deleted", { organizationId: ctx.organizationId, id });
    }

    return deleted;
  }

  /**
   * Re-expresses every budget limit in a new base currency.
   *
   * Budget amounts carry no currency of their own — they are compared against
   * `baseAmount` sums — so a space that switches base currency would otherwise
   * be left with limits that are bare numbers in the currency it left behind.
   *
   * Converted at today's rate rather than at each budget's `startDate`: a limit
   * is a forward-looking intention, not a historical fact, so what it is worth
   * now is the figure that matters.
   *
   * Returns the write rather than performing it, so it can go into the same
   * transaction as the entry re-conversion and the currency switch itself —
   * see `changeBaseCurrency`. Every conversion is still computed here, before
   * any statement is handed back, so a missing rate throws with nothing written.
   *
   * @param convert Supplied by the caller so this stays free of the exchange
   * rate service, which would otherwise be a cycle through `space.service`.
   *
   * @returns The statement, and how many budgets it covers. The statement is
   * `null` when the space has no budgets.
   */
  async reconvertStatement(
    organizationId: string,
    userId: string,
    convert: (amount: string) => Promise<string>,
  ): Promise<{ statement: BatchStatement | null; count: number }> {
    const all = await budgetRepository.findAll(organizationId);

    if (all.length === 0) {
      return { statement: null, count: 0 };
    }

    const converted = await Promise.all(
      all.map(async (budget) => ({ id: budget.id, amount: await convert(budget.amount) })),
    );

    return {
      statement: budgetRepository.reconvertStatement(organizationId, userId, converted),
      count: converted.length,
    };
  }

  /**
   * A budget limits spending, so it has to point at an expense category in this
   * space. An income category would put a limit on a list the expense pickers
   * never offer, and a category from another space would leak its name.
   */
  private async assertUsableCategory(ctx: SpaceContext, categoryId: number): Promise<void> {
    return categoryService.assertUsable(ctx, categoryId, "expense", {
      mismatchMessage: "Budgets apply to expense categories.",
    });
  }
}

export const budgetService = new BudgetService();
