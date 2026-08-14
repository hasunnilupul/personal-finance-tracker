import ProgressMeter from "@/components/charts/progress-meter";
import { BudgetState } from "@/lib/db/models/budget.model";

interface BudgetProgressBarProps {
  /** Spend as a fraction of the limit. May exceed 1. */
  ratio: number;
  state: BudgetState;
  label: string;
}

/**
 * A budget's fill colour carries severity: green while there is room, amber
 * approaching the limit, red past it.
 */
const FILL: Record<BudgetState, string> = {
  under: "bg-emerald-500",
  near: "bg-amber-500",
  over: "bg-destructive",
};

/**
 * How much of a limit is used.
 *
 * The meter itself is shared with savings goals — see {@link ProgressMeter}.
 * What is specific to a budget is the mapping from state to colour, because
 * here a full bar is bad news, where on a goal it is the point.
 */
const BudgetProgressBar = ({ ratio, state, label }: BudgetProgressBarProps) => {
  return <ProgressMeter ratio={ratio} fillClassName={FILL[state]} label={label} />;
};

export default BudgetProgressBar;
