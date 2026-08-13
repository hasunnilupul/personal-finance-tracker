import GoalManager from "@/components/goals/goal-manager";
import { requireActiveSpace } from "@/lib/auth/dal";
import { savingsGoalService } from "@/lib/services/savings-goal.service";

/**
 * Savings goals: what is being saved for, how far along it is, and what it
 * takes each month to arrive on time.
 *
 * A goal is a target rather than an account — no money moves between it and the
 * ledger. Recording a contribution says "this much of what I have is spoken
 * for", which is what makes the monthly figure meaningful without inventing a
 * second place for money to live.
 */
const GoalsPage = async () => {
  const { ctx, space } = await requireActiveSpace();
  const goals = await savingsGoalService.getAll(ctx);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Savings goals</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Targets in {space.baseCurrency}, highest priority first.
          {space.isPersonal ? "" : ` Shared with everyone in ${space.name}.`}
        </p>
      </div>

      <GoalManager goals={goals} baseCurrency={space.baseCurrency} />
    </div>
  );
};

export default GoalsPage;
