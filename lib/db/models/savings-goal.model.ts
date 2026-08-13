import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { savingsGoals } from "@/lib/db/schema/savings-goals";

export type SavingsGoal = InferSelectModel<typeof savingsGoals>;
export type NewSavingsGoal = InferInsertModel<typeof savingsGoals>;

/** Fields a caller may set; the service supplies the rest. */
export type SavingsGoalInput = UserInput<NewSavingsGoal>;

/**
 * Where a goal stands.
 *
 * `reached` is kept separate from `ratio >= 1` so the two can never disagree
 * once a target is lowered below what is already saved.
 */
export interface GoalProgress {
  /** Target minus saved. Zero once reached, never negative. */
  remaining: string;
  /** Saved as a fraction of the target. Capped at 1 for the bar's width. */
  ratio: number;
  reached: boolean;
  /**
   * Whole days until the deadline. Negative once it has passed, `null` when
   * the goal has no deadline.
   */
  daysLeft: number | null;
  /** Past its deadline without reaching the target. */
  overdue: boolean;
  /**
   * What must be put aside each month from now to arrive on time, or `null`
   * when there is no deadline, it has passed, or the goal is already reached.
   *
   * The figure a savings goal is actually for: "45,000 short, three months
   * left" is arithmetic nobody should have to do in their head.
   */
  perMonth: string | null;
}

export interface GoalWithProgress extends SavingsGoal, GoalProgress {}

const DAY = 86_400_000;

/**
 * Days from `now` to a deadline, counted in whole UTC days.
 *
 * Both ends are floored to a date first, so a deadline "tomorrow" reads as 1
 * whether it is looked at in the morning or last thing at night.
 */
function daysBetween(now: Date, deadline: Date): number {
  const from = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const to = Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate());

  return Math.round((to - from) / DAY);
}

/**
 * Works out where a goal stands against its target and deadline.
 */
export function toGoalProgress(goal: SavingsGoal, now: Date = new Date()): GoalWithProgress {
  const target = Number(goal.targetAmount);
  const saved = Number(goal.currentAmount);

  const reached = saved >= target;
  const shortfall = Math.max(0, target - saved);
  const daysLeft = goal.deadline ? daysBetween(now, goal.deadline) : null;

  // Months rounded up, and never less than one: with 20 days left the whole
  // shortfall is this month's problem, not two thirds of it.
  const monthsLeft = daysLeft === null ? null : Math.max(1, Math.ceil(daysLeft / 30));

  return {
    ...goal,
    remaining: shortfall.toFixed(2),
    ratio: target > 0 ? Math.min(1, saved / target) : 0,
    reached,
    daysLeft,
    overdue: daysLeft !== null && daysLeft < 0 && !reached,
    perMonth:
      reached || daysLeft === null || daysLeft < 0 || monthsLeft === null
        ? null
        : (shortfall / monthsLeft).toFixed(2),
  };
}
