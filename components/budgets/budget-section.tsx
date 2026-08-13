"use client";

import { useState } from "react";
import { PlusIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import BudgetDeleteDialog from "@/components/budgets/budget-delete-dialog";
import BudgetFormDialog from "@/components/budgets/budget-form-dialog";
import BudgetList from "@/components/budgets/budget-list";
import BudgetProgressBar from "@/components/budgets/budget-progress-bar";
import {
  BudgetedCategoryIds,
  BudgetPeriod,
  BudgetPeriodSummary,
  BudgetWithProgress,
  toBudgetState,
} from "@/lib/db/models/budget.model";
import { Category } from "@/lib/db/models/category.model";
import { formatMoney } from "@/lib/currency/format";

interface BudgetSectionProps {
  period: BudgetPeriod;
  /** What the window is called — "August 2026" or "2026". */
  windowLabel: string;
  budgets: BudgetWithProgress[];
  summary: BudgetPeriodSummary;
  categories: Category[];
  takenByPeriod: BudgetedCategoryIds;
  baseCurrency: string;
  /** Whether the window being shown is one a new budget would apply to. */
  canAdd: boolean;
}

/**
 * One period type's budgets for the window on screen.
 *
 * Monthly and yearly are two sections on one page, following the categories
 * screen: a household has a handful of each, and seeing both at once is what
 * makes it clear which limit a month's spending is being measured against.
 */
const BudgetSection = ({
  period,
  windowLabel,
  budgets,
  summary,
  categories,
  takenByPeriod,
  baseCurrency,
  canAdd,
}: BudgetSectionProps) => {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BudgetWithProgress | undefined>();
  // Held by id so a refresh reaches the open dialog with the current row rather
  // than the copy it opened with.
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const deleting = budgets.find((budget) => budget.id === deletingId);

  const heading = period === "monthly" ? "Monthly budgets" : "Yearly budgets";
  const budgeted = Number(summary.budgeted);
  const spent = Number(summary.spent);
  const ratio = budgeted > 0 ? spent / budgeted : 0;
  const state = toBudgetState(budgeted, spent);

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  return (
    <>
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold tracking-tight">{heading}</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">{windowLabel}</p>
          </div>

          {canAdd && (
            <Button onClick={openAdd}>
              <PlusIcon />
              Add
            </Button>
          )}
        </div>

        {budgets.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-foreground text-sm font-medium">
              No {period} budgets {canAdd ? "yet" : `were in effect in ${windowLabel}`}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {canAdd
                ? `Set a limit on a category and this ${period === "monthly" ? "month" : "year"}'s spending is measured against it.`
                : "A budget applies from the period it was created in onwards."}
            </p>

            {canAdd && (
              <Button className="mt-4" variant="outline" onClick={openAdd}>
                Add a {period} budget
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-muted-foreground text-xs">
                  {formatMoney(summary.spent, baseCurrency)} of{" "}
                  {formatMoney(summary.budgeted, baseCurrency)} budgeted
                </p>

                {summary.overCount > 0 && (
                  <p className="text-destructive text-xs font-medium">
                    {summary.overCount} over budget
                  </p>
                )}
              </div>

              <BudgetProgressBar
                ratio={ratio}
                state={state}
                label={`${heading} in total: ${Math.round(ratio * 100)}% of the budgeted amount used`}
              />
            </div>

            <div className="mt-2">
              <BudgetList
                budgets={budgets}
                baseCurrency={baseCurrency}
                onEdit={(budget) => {
                  setEditing(budget);
                  setFormOpen(true);
                }}
                onDelete={(budget) => setDeletingId(budget.id)}
              />
            </div>
          </>
        )}
      </Card>

      <BudgetFormDialog
        period={period}
        categories={categories}
        baseCurrency={baseCurrency}
        budget={editing}
        takenByPeriod={takenByPeriod}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      {deleting && (
        <BudgetDeleteDialog
          budget={deleting}
          baseCurrency={baseCurrency}
          open
          onOpenChange={(open) => !open && setDeletingId(null)}
        />
      )}
    </>
  );
};

export default BudgetSection;
