import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { budgets } from "@/lib/db/schema/budgets";

export type Budget = InferSelectModel<typeof budgets>;
export type NewBudget = InferInsertModel<typeof budgets>;

/** Fields a caller may set; the service supplies the rest. */
export type BudgetInput = UserInput<NewBudget>;

/**
 * How often a budget resets.
 *
 * The column is a `varchar`, so this is the type-level guard — every write goes
 * through a zod enum at the action boundary and through the service, which
 * refuses anything else.
 */
export type BudgetPeriod = "monthly" | "yearly";

export const BUDGET_PERIODS = ["monthly", "yearly"] as const;

/**
 * How a budget is doing against real spending.
 *
 * `spent` and `remaining` are decimal strings, like every other amount in the
 * app, because they come out of a Postgres `numeric` sum and rounding them into
 * a JavaScript number early would be a lie in the last cent. `ratio` is a
 * number because it only ever drives a progress bar's width.
 */
export interface BudgetProgress {
  spent: string;
  /** Limit minus spend. Negative once over budget. */
  remaining: string;
  /** Spend as a fraction of the limit. Can exceed 1. */
  ratio: number;
  state: BudgetState;
}

/**
 * `near` is spending that has not broken the limit but is close enough to be
 * worth a different colour — the point of a budget is to warn before the fact,
 * not after it.
 */
export type BudgetState = "under" | "near" | "over";

/**
 * The fraction of a limit at which a budget starts reading as `near`.
 */
export const BUDGET_NEAR_THRESHOLD = 0.8;

/**
 * Where spending sits against a limit.
 *
 * One rule for both the per-budget rows and the section totals, so a page can
 * never show every row green under a red total. A limit of zero — which the
 * validation refuses but an old row could hold — reads as `under` rather than
 * dividing by it.
 */
export function toBudgetState(limit: number, spent: number): BudgetState {
  if (limit <= 0) {
    return "under";
  }

  if (spent > limit) {
    return "over";
  }

  return spent / limit >= BUDGET_NEAR_THRESHOLD ? "near" : "under";
}

/**
 * A budget as the list renders it: the row, the category it limits, and its
 * progress in the window being shown.
 */
export interface BudgetWithProgress extends BudgetProgress {
  id: number;
  categoryId: number | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
  amount: string;
  period: BudgetPeriod;
  startDate: Date;
}

/**
 * Categories that already hold a budget, per period.
 *
 * The form uses it to avoid offering a category that would be refused on save.
 * Keyed by period because a category taken monthly may well be free yearly.
 */
export type BudgetedCategoryIds = Record<BudgetPeriod, number[]>;

/**
 * Everything the budgets page shows for one period type in one window.
 */
export interface BudgetPeriodSummary {
  budgeted: string;
  spent: string;
  /** How many budgets in the set are over their limit. */
  overCount: number;
}
