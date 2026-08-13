import { savingsGoalRepository } from "@/lib/repositories/savings-goal.repository";
import { SavingsGoal } from "@/lib/db/models/savings-goal.model";
import { GoalWithProgress, toGoalProgress } from "@/lib/db/models/savings-goal.model";
import { SpaceContext } from "@/lib/services/types";
import { ServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";

/**
 * What a caller may set on a goal.
 *
 * `currentAmount` is absent on purpose: money moves in and out through
 * {@link SavingsGoalService.contribute}, which clamps and validates. Letting a
 * form post it directly would make "add 5,000" and "set it to 5,000" the same
 * request, and the difference matters when two people are saving into one goal.
 */
export interface SavingsGoalFields {
  name: string;
  targetAmount: string;
  deadline: Date | null;
  priority: GoalPriority;
}

export type GoalPriority = "low" | "medium" | "high";

export const GOAL_PRIORITIES = ["low", "medium", "high"] as const;

export class SavingsGoalService {
  /**
   * Every goal in the space, with progress worked out.
   *
   * Ordered by priority then deadline, so the goal that matters soonest is
   * first — an unordered list of savings targets is just a list.
   */
  async getAll(ctx: SpaceContext, now: Date = new Date()): Promise<GoalWithProgress[]> {
    const goals = await savingsGoalRepository.findAll(ctx.organizationId);

    return goals
      .map((goal) => toGoalProgress(goal, now))
      .sort((a, b) => {
        const rank = { high: 0, medium: 1, low: 2 } as const;
        const byPriority = rank[a.priority as GoalPriority] - rank[b.priority as GoalPriority];

        if (byPriority !== 0) {
          return byPriority;
        }

        // A goal with a deadline outranks one without: it is the one that can
        // actually be late.
        if (a.deadline && b.deadline) {
          return a.deadline.getTime() - b.deadline.getTime();
        }

        if (a.deadline) return -1;
        if (b.deadline) return 1;

        return a.id - b.id;
      });
  }

  async getById(ctx: SpaceContext, id: number): Promise<SavingsGoal | undefined> {
    return savingsGoalRepository.findById(id, ctx.organizationId);
  }

  async create(ctx: SpaceContext, fields: SavingsGoalFields): Promise<SavingsGoal> {
    this.assertUsable(fields);

    const created = await savingsGoalRepository.create({
      ...fields,
      currentAmount: "0",
      organizationId: ctx.organizationId,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });

    logger.info("Savings goal created", { organizationId: ctx.organizationId, id: created.id });

    return created;
  }

  /**
   * Edits a goal's name, target, deadline or priority.
   *
   * The target may be lowered below what is already saved. That is not an
   * error — deciding a trip costs less than planned is a normal thing to do —
   * and the goal simply reads as complete.
   */
  async update(
    ctx: SpaceContext,
    id: number,
    fields: SavingsGoalFields,
  ): Promise<SavingsGoal | undefined> {
    this.assertUsable(fields);

    return savingsGoalRepository.update(id, ctx.organizationId, {
      ...fields,
      updatedBy: ctx.userId,
    });
  }

  async delete(ctx: SpaceContext, id: number): Promise<boolean> {
    const deleted = await savingsGoalRepository.delete(id, ctx.organizationId);

    if (deleted) {
      logger.info("Savings goal deleted", { organizationId: ctx.organizationId, id });
    }

    return deleted;
  }

  /**
   * Moves money into or out of a goal.
   *
   * Read-modify-write rather than a bare `set`, so two people paying into the
   * same goal both count. It is still not atomic — the HTTP driver has no
   * interactive transactions — so two contributions landing in the same instant
   * can lose one. For a household goal that is a rare and visible loss rather
   * than a silent corruption, and the alternative is a ledger table this
   * feature does not otherwise need.
   *
   * @param delta Signed decimal string. Negative withdraws.
   *
   * @throws {ServiceError} `VALIDATION_FAILED` when the withdrawal is larger
   * than the balance — a goal cannot hold less than nothing.
   */
  async contribute(ctx: SpaceContext, id: number, delta: string): Promise<SavingsGoal | undefined> {
    const goal = await savingsGoalRepository.findById(id, ctx.organizationId);

    if (!goal) {
      return undefined;
    }

    const next = Number(goal.currentAmount) + Number(delta);

    if (next < 0) {
      throw new ServiceError(
        "VALIDATION_FAILED",
        `There is only ${goal.currentAmount} in that goal.`,
      );
    }

    return savingsGoalRepository.update(id, ctx.organizationId, {
      currentAmount: next.toFixed(2),
      updatedBy: ctx.userId,
    });
  }

  private assertUsable(fields: SavingsGoalFields): void {
    if (Number(fields.targetAmount) <= 0) {
      throw new ServiceError("VALIDATION_FAILED", "Set a target greater than zero.");
    }
  }
}

export const savingsGoalService = new SavingsGoalService();
