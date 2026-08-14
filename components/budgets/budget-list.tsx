"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import BudgetProgressBar from "@/components/budgets/budget-progress-bar";
import { BudgetWithProgress } from "@/lib/db/models/budget.model";
import { formatMoney } from "@/lib/currency/format";
import { cn } from "@/lib/utils";

interface BudgetListProps {
  budgets: BudgetWithProgress[];
  baseCurrency: string;
  onEdit: (budget: BudgetWithProgress) => void;
  onDelete: (budget: BudgetWithProgress) => void;
}

/**
 * What is left, or how far over.
 *
 * Over-budget is the case a reader is looking for, so it gets the plain words
 * and the destructive colour rather than a negative number to interpret.
 */
function remainingLabel(budget: BudgetWithProgress, baseCurrency: string): string {
  const remaining = Number(budget.remaining);

  return remaining < 0
    ? `Over by ${formatMoney(Math.abs(remaining), baseCurrency)}`
    : `${formatMoney(remaining, baseCurrency)} left`;
}

const BudgetList = ({ budgets, baseCurrency, onEdit, onDelete }: BudgetListProps) => {
  return (
    <ul className="divide-border divide-y">
      {budgets.map((budget) => {
        const name = budget.categoryName ?? "Uncategorised";
        const percent = Math.round(budget.ratio * 100);

        return (
          <li key={budget.id} className="flex flex-col gap-2 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span
                  aria-hidden
                  className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
                  style={{ backgroundColor: `${budget.categoryColor ?? "#94a3b8"}33` }}
                >
                  {budget.categoryIcon ?? "•"}
                </span>

                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm font-medium">{name}</p>
                  <p className="text-muted-foreground mt-0.5 truncate text-xs">
                    {formatMoney(budget.spent, baseCurrency)} of{" "}
                    {formatMoney(budget.amount, baseCurrency)}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <span
                  className={cn(
                    "mr-1 text-xs font-medium tabular-nums",
                    budget.state === "over" ? "text-destructive" : "text-muted-foreground",
                  )}
                >
                  {percent}%
                </span>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit the ${name} budget`}
                  onClick={() => onEdit(budget)}
                >
                  <PencilIcon />
                </Button>

                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete the ${name} budget`}
                  onClick={() => onDelete(budget)}
                >
                  <Trash2Icon />
                </Button>
              </div>
            </div>

            <BudgetProgressBar
              ratio={budget.ratio}
              state={budget.state}
              label={`${name}: ${percent}% of the limit used`}
            />

            <p
              className={cn(
                "text-xs",
                budget.state === "over" ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {remainingLabel(budget, baseCurrency)}
            </p>
          </li>
        );
      })}
    </ul>
  );
};

export default BudgetList;
