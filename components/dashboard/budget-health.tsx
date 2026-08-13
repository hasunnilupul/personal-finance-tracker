import Link from "next/link";

import BudgetProgressBar from "@/components/budgets/budget-progress-bar";
import { BudgetWithProgress } from "@/lib/db/models/budget.model";
import { formatMoney } from "@/lib/currency/format";

interface BudgetHealthProps {
  budgets: BudgetWithProgress[];
  /** How many monthly budgets exist, of which `budgets` is the worst few. */
  total: number;
  baseCurrency: string;
}

/**
 * This month's budgets, the ones in trouble first.
 *
 * Reuses the budgets page's own meter, so a bar means the same thing in both
 * places — the point of a budget is to warn before the limit, and two
 * implementations of "near" would eventually disagree about where that is.
 */
const BudgetHealth = ({ budgets, total, baseCurrency }: BudgetHealthProps) => {
  if (budgets.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-foreground text-sm font-medium">No budgets this month</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Set a limit on a category and this month&apos;s spending is measured against it.
        </p>
        <Link
          href="/budgets"
          className="text-foreground mt-3 inline-block text-sm underline underline-offset-2"
        >
          Set a budget
        </Link>
      </div>
    );
  }

  return (
    <>
      <ul className="mt-3 flex flex-col gap-3">
        {budgets.map((budget) => (
          <li key={budget.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-foreground flex min-w-0 items-center gap-2 text-sm">
                <span aria-hidden className="shrink-0">
                  {budget.categoryIcon ?? "•"}
                </span>
                <span className="truncate">{budget.categoryName ?? "Category removed"}</span>
              </p>

              <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
                {formatMoney(budget.spent, baseCurrency)} of{" "}
                {formatMoney(budget.amount, baseCurrency)}
              </p>
            </div>

            <div className="mt-1.5">
              <BudgetProgressBar
                ratio={budget.ratio}
                state={budget.state}
                label={`${budget.categoryName ?? "Budget"}: ${Math.round(budget.ratio * 100)}% of the limit used`}
              />
            </div>
          </li>
        ))}
      </ul>

      {total > budgets.length && (
        <Link
          href="/budgets"
          className="text-muted-foreground hover:text-foreground mt-3 inline-block text-xs underline underline-offset-2"
        >
          {total - budgets.length} more {total - budgets.length === 1 ? "budget" : "budgets"}
        </Link>
      )}
    </>
  );
};

export default BudgetHealth;
