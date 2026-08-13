import { BudgetState } from "@/lib/db/models/budget.model";
import { cn } from "@/lib/utils";

interface BudgetProgressBarProps {
  /** Spend as a fraction of the limit. May exceed 1. */
  ratio: number;
  state: BudgetState;
  label: string;
}

const FILL: Record<BudgetState, string> = {
  under: "bg-emerald-500",
  near: "bg-amber-500",
  over: "bg-destructive",
};

/**
 * How much of a limit is used.
 *
 * A plain element rather than a component from a UI library: this is a div with
 * a width, and the meter role gives assistive technology the same reading the
 * bar gives visually.
 *
 * The fill is capped at 100% so an overspend does not paint outside the track;
 * the colour and the figures beside it are what say how far over it went.
 */
const BudgetProgressBar = ({ ratio, state, label }: BudgetProgressBarProps) => {
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));

  return (
    <div
      role="meter"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className="bg-muted h-2 w-full overflow-hidden rounded-full"
    >
      <div
        className={cn("h-full rounded-full transition-[width]", FILL[state])}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
};

export default BudgetProgressBar;
