"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BudgetFormState,
  createBudgetAction,
  updateBudgetAction,
} from "@/app/actions/budget.actions";
import { Category } from "@/lib/db/models/category.model";
import {
  BudgetedCategoryIds,
  BudgetPeriod,
  BudgetWithProgress,
} from "@/lib/db/models/budget.model";

const initialState: BudgetFormState = {};

const PERIOD_LABEL: Record<BudgetPeriod, string> = {
  monthly: "Monthly",
  yearly: "Yearly",
};

const PERIOD_NOUN: Record<BudgetPeriod, string> = {
  monthly: "month",
  yearly: "year",
};

interface BudgetFormProps {
  period: BudgetPeriod;
  categories: Category[];
  baseCurrency: string;
  budget?: BudgetWithProgress;
  takenByPeriod: BudgetedCategoryIds;
  onDone: () => void;
}

/**
 * The form body.
 *
 * Split out so the dialog can remount it with a `key` when the budget being
 * edited changes — resetting the pickers and any stale validation errors
 * without synchronising state in an effect, which `react-hooks/set-state-in-effect`
 * would fail lint over.
 */
const BudgetForm = ({
  period,
  categories,
  baseCurrency,
  budget,
  takenByPeriod,
  onDone,
}: BudgetFormProps) => {
  const router = useRouter();
  const isEditing = Boolean(budget);

  const [state, formAction, pending] = useActionState(
    isEditing ? updateBudgetAction : createBudgetAction,
    initialState,
  );

  const [selectedPeriod, setSelectedPeriod] = useState<BudgetPeriod>(budget?.period ?? period);
  const [categoryId, setCategoryId] = useState(budget?.categoryId ? String(budget.categoryId) : "");

  useEffect(() => {
    if (state.success) {
      toast.success(isEditing ? "Budget updated" : "Budget created");
      onDone();
      router.refresh();
    }
  }, [state.success, isEditing, onDone, router]);

  // A category that already has a budget for the chosen period would be refused
  // by the service, so it is not offered — except the one being edited, which
  // keeps its own category. The service re-checks either way; this only spares
  // the user a refusal they could not have predicted.
  const taken = new Set(
    takenByPeriod[selectedPeriod].filter(
      (id) => !(budget?.period === selectedPeriod && id === budget.categoryId),
    ),
  );
  const available = categories.filter((category) => !taken.has(category.id));

  // Derived rather than synchronised: switching the period can take the current
  // selection away, and resolving that at render keeps it out of an effect.
  const effectiveCategoryId = available.some((category) => String(category.id) === categoryId)
    ? categoryId
    : (available[0] && String(available[0].id)) || "";

  const fieldError = (name: string) => state.fieldErrors?.[name];
  const selected = available.find((category) => String(category.id) === effectiveCategoryId);
  const noun = PERIOD_NOUN[selectedPeriod];

  // `items` is what makes each trigger show a label rather than the raw value
  // the form posts — see Gotchas.
  const categoryItems = available.map((category) => ({
    value: String(category.id),
    label: `${category.icon} ${category.name}`,
  }));
  const periodItems = (Object.keys(PERIOD_LABEL) as BudgetPeriod[]).map((option) => ({
    value: option,
    label: PERIOD_LABEL[option],
  }));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit budget" : "New budget"}</DialogTitle>
        <DialogDescription>
          {isEditing
            ? `The limit covers the whole ${noun}, including spending already recorded in it.`
            : `A limit in ${baseCurrency}, in effect from this ${noun} onwards.`}
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        {budget && <input type="hidden" name="id" value={budget.id} />}
        <input type="hidden" name="categoryId" value={effectiveCategoryId} />
        <input type="hidden" name="period" value={selectedPeriod} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="budget-category">Category</Label>

          {available.length === 0 ? (
            <p className="text-muted-foreground border-border rounded-md border border-dashed px-3 py-2 text-sm">
              Every expense category already has a {selectedPeriod} budget. Edit one of those, pick
              another period, or add a category first.
            </p>
          ) : (
            <Select
              items={categoryItems}
              value={effectiveCategoryId}
              onValueChange={(value) => setCategoryId(String(value))}
            >
              <SelectTrigger id="budget-category" className="w-full">
                <SelectValue placeholder="Pick a category" />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {fieldError("categoryId") && (
            <p className="text-destructive text-sm">{fieldError("categoryId")}</p>
          )}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="amount">Limit</Label>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={budget?.amount ?? ""}
              required
              autoFocus
            />
          </div>

          <div className="flex w-32 flex-col gap-2">
            <Label htmlFor="budget-period">Resets</Label>
            <Select
              items={periodItems}
              value={selectedPeriod}
              onValueChange={(value) => setSelectedPeriod(String(value) as BudgetPeriod)}
            >
              <SelectTrigger id="budget-period" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {fieldError("amount") && <p className="text-destructive text-sm">{fieldError("amount")}</p>}

        <p className="text-muted-foreground text-xs">
          {selected ? `${selected.name} spending` : "Spending"} is measured over the whole calendar{" "}
          {noun}, in {baseCurrency}.
        </p>

        {state.error && (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending || !effectiveCategoryId}>
            {pending ? "Saving..." : isEditing ? "Save changes" : "Create budget"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

interface BudgetFormDialogProps {
  period: BudgetPeriod;
  categories: Category[];
  baseCurrency: string;
  budget?: BudgetWithProgress;
  takenByPeriod: BudgetedCategoryIds;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const BudgetFormDialog = ({
  period,
  categories,
  baseCurrency,
  budget,
  takenByPeriod,
  open,
  onOpenChange,
}: BudgetFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <BudgetForm
          key={budget?.id ?? `new-${period}`}
          period={period}
          categories={categories}
          baseCurrency={baseCurrency}
          budget={budget}
          takenByPeriod={takenByPeriod}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default BudgetFormDialog;
