"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
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
  createRecurringAction,
  RecurringFormState,
  updateRecurringAction,
} from "@/app/actions/recurring.actions";
import { RecurringWithCategory } from "@/lib/repositories/recurring-transaction.repository";
import { Category } from "@/lib/db/models/category.model";
import { TransactionKind } from "@/lib/db/models/transaction.model";
import { FREQUENCIES, FREQUENCY_LABEL, Frequency } from "@/lib/recurring/schedule";
import { SUPPORTED_CURRENCIES } from "@/constants/currencies";

const initialState: RecurringFormState = {};

const NONE = "none";

interface RecurringFormProps {
  template?: RecurringWithCategory;
  expenseCategories: Category[];
  incomeCategories: Category[];
  baseCurrency: string;
  onDone: () => void;
}

const toDayValue = (date: Date) => date.toISOString().slice(0, 10);

/**
 * The form body, remounted with a `key` when the template changes rather than
 * synced in an effect — see the budget form for why.
 */
const RecurringForm = ({
  template,
  expenseCategories,
  incomeCategories,
  baseCurrency,
  onDone,
}: RecurringFormProps) => {
  const router = useRouter();
  const isEditing = Boolean(template);

  const [state, formAction, pending] = useActionState(
    isEditing ? updateRecurringAction : createRecurringAction,
    initialState,
  );

  const [type, setType] = useState<TransactionKind>(
    (template?.type as TransactionKind) ?? "expense",
  );
  const [frequency, setFrequency] = useState<Frequency>(
    (template?.frequency as Frequency) ?? "monthly",
  );
  const [currency, setCurrency] = useState(template?.currency ?? baseCurrency);
  const [categoryId, setCategoryId] = useState(
    template?.categoryId ? String(template.categoryId) : NONE,
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEditing ? "Template updated" : "Template created");
      onDone();
      router.refresh();
    }
  }, [state.success, isEditing, onDone, router]);

  const categories = type === "expense" ? expenseCategories : incomeCategories;

  // Switching side can strip the selection away — resolved at render rather
  // than synchronised, so there is no effect to fight with lint.
  const effectiveCategoryId = useMemo(
    () => (categories.some((category) => String(category.id) === categoryId) ? categoryId : NONE),
    [categories, categoryId],
  );

  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit template" : "New recurring entry"}</DialogTitle>
        <DialogDescription>
          Entries are created automatically from the first date onwards. Dating it in the past fills
          in what has already happened.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        {template && <input type="hidden" name="id" value={template.id} />}
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="frequency" value={frequency} />
        <input type="hidden" name="currency" value={currency} />
        {effectiveCategoryId !== NONE && (
          <input type="hidden" name="categoryId" value={effectiveCategoryId} />
        )}
        <input type="hidden" name="isActive" value={String(template?.isActive ?? true)} />

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="recurring-type">Kind</Label>
            <Select
              value={type}
              onValueChange={(value) => setType(String(value) as TransactionKind)}
            >
              <SelectTrigger id="recurring-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Expense</SelectItem>
                <SelectItem value="income">Income</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="recurring-frequency">Repeats</Label>
            <Select
              value={frequency}
              onValueChange={(value) => setFrequency(String(value) as Frequency)}
            >
              <SelectTrigger id="recurring-frequency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCIES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {FREQUENCY_LABEL[option]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="recurring-amount">Amount</Label>
            <Input
              id="recurring-amount"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={template?.amount ?? ""}
              required
              autoFocus
            />
          </div>

          <div className="flex w-28 flex-col gap-2">
            <Label htmlFor="recurring-currency">Currency</Label>
            <Select value={currency} onValueChange={(value) => setCurrency(String(value))}>
              <SelectTrigger id="recurring-currency" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_CURRENCIES.map((option) => (
                  <SelectItem key={option.code} value={option.code}>
                    {option.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {fieldError("amount") && <p className="text-destructive text-sm">{fieldError("amount")}</p>}

        <div className="flex flex-col gap-2">
          <Label htmlFor="recurring-category">Category</Label>
          <Select
            value={effectiveCategoryId}
            onValueChange={(value) => setCategoryId(String(value))}
          >
            <SelectTrigger id="recurring-category" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>No category</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={String(category.id)}>
                  {category.icon} {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="recurring-description">Description</Label>
          <Input
            id="recurring-description"
            name="description"
            placeholder="Rent"
            defaultValue={template?.description ?? ""}
          />
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="recurring-start">First date</Label>
            <Input
              id="recurring-start"
              name="startDate"
              type="date"
              defaultValue={toDayValue(template?.startDate ?? new Date())}
              required
            />
          </div>

          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="recurring-end">Until (optional)</Label>
            <Input
              id="recurring-end"
              name="endDate"
              type="date"
              defaultValue={template?.endDate ? toDayValue(template.endDate) : ""}
            />
          </div>
        </div>

        {(fieldError("startDate") || fieldError("endDate")) && (
          <p className="text-destructive text-sm">
            {fieldError("startDate") ?? fieldError("endDate")}
          </p>
        )}

        {state.error && (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" disabled={pending} onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Saving..." : isEditing ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

interface RecurringFormDialogProps {
  template?: RecurringWithCategory;
  expenseCategories: Category[];
  incomeCategories: Category[];
  baseCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const RecurringFormDialog = ({
  template,
  expenseCategories,
  incomeCategories,
  baseCurrency,
  open,
  onOpenChange,
}: RecurringFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <RecurringForm
          key={template?.id ?? "new"}
          template={template}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          baseCurrency={baseCurrency}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default RecurringFormDialog;
