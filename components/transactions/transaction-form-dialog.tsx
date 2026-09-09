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
  createTransactionAction,
  TransactionFormState,
  updateTransactionAction,
} from "@/app/actions/transaction.actions";
import { SUPPORTED_CURRENCIES } from "@/constants/currencies";
import { Category } from "@/lib/db/models/category.model";
import {
  SavingsLiquidity,
  TransactionKind,
  TransactionListItem,
} from "@/lib/db/models/transaction.model";

const initialState: TransactionFormState = {};

/**
 * Formats a date for `<input type="date">`, which wants local `YYYY-MM-DD`.
 */
function toDateInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000;

  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

interface TransactionFormProps {
  kind: TransactionKind;
  categories: Category[];
  baseCurrency: string;
  transaction?: TransactionListItem;
  onDone: () => void;
}

/**
 * The form body.
 *
 * Split out so the dialog can remount it with a `key` when the entry being
 * edited changes. That resets the currency and category pickers — and any
 * stale validation errors — without synchronising state in an effect.
 */
const TransactionForm = ({
  kind,
  categories,
  baseCurrency,
  transaction,
  onDone,
}: TransactionFormProps) => {
  const router = useRouter();
  const isEditing = Boolean(transaction);

  const [state, formAction, pending] = useActionState(
    isEditing ? updateTransactionAction : createTransactionAction,
    initialState,
  );

  const [currency, setCurrency] = useState(transaction?.currency ?? baseCurrency);
  const [categoryId, setCategoryId] = useState(
    transaction?.categoryId ? String(transaction.categoryId) : "none",
  );
  const [liquidity, setLiquidity] = useState<SavingsLiquidity>(transaction?.liquidity ?? "liquid");
  // A withdrawal is stored as a negative amount — same signed-delta
  // convention a savings goal's contribution uses. The amount field always
  // shows and accepts a positive magnitude; direction is a separate control
  // rather than a minus sign typed into it, which is easy to miss.
  const [direction, setDirection] = useState<"add" | "withdraw">(
    transaction && Number(transaction.amount) < 0 ? "withdraw" : "add",
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEditing ? "Entry updated" : "Entry added");
      onDone();
      router.refresh();
    }
  }, [state.success, isEditing, onDone, router]);

  const noun = kind === "expense" ? "expense" : kind === "income" ? "income" : "saving";
  const fieldError = (name: string) => state.fieldErrors?.[name];

  // `items` is what makes each trigger show a label rather than the raw value
  // the form posts — see Gotchas. The currency picker's label happens to be its
  // own code; it is listed anyway so every Select here follows one rule.
  const currencyItems = SUPPORTED_CURRENCIES.map((option) => ({
    value: option.code,
    label: option.code,
  }));
  const categoryItems = [
    { value: "none", label: "Uncategorised" },
    ...categories.map((category) => ({
      value: String(category.id),
      label: `${category.icon} ${category.name}`,
    })),
  ];
  const liquidityItems = [
    { value: "liquid", label: "Can still spend it" },
    { value: "locked", label: "Set aside long-term (e.g. an investment)" },
  ];
  const directionItems = [
    { value: "add", label: "Add to savings" },
    { value: "withdraw", label: "Take out of savings" },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Edit" : "Add"} {noun}
        </DialogTitle>
        <DialogDescription>
          {currency === baseCurrency
            ? `Recorded in ${baseCurrency}.`
            : `Converted into ${baseCurrency} at the rate for the date you pick.`}
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="kind" value={kind} />
        {transaction && <input type="hidden" name="id" value={transaction.id} />}
        <input type="hidden" name="currency" value={currency} />
        {kind === "savings" ? (
          <>
            <input type="hidden" name="liquidity" value={liquidity} />
            <input type="hidden" name="direction" value={direction} />
          </>
        ) : (
          <input type="hidden" name="categoryId" value={categoryId} />
        )}

        {kind === "savings" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="direction-trigger">Direction</Label>
            <Select
              items={directionItems}
              value={direction}
              onValueChange={(value) => setDirection(value as "add" | "withdraw")}
            >
              <SelectTrigger id="direction-trigger" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {directionItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="amount">Amount</Label>
            <Input
              id="amount"
              name="amount"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={transaction ? Math.abs(Number(transaction.amount)).toFixed(2) : ""}
              required
              autoFocus
            />
          </div>

          <div className="flex w-28 flex-col gap-2">
            <Label htmlFor="currency-trigger">Currency</Label>
            <Select
              items={currencyItems}
              value={currency}
              onValueChange={(value) => setCurrency(String(value))}
            >
              <SelectTrigger id="currency-trigger" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {fieldError("amount") && (
          <p className="text-destructive -mt-2 text-sm">{fieldError("amount")}</p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="date">Date</Label>
          <Input
            id="date"
            name="date"
            type="date"
            defaultValue={toDateInput(transaction?.date ?? new Date())}
            required
          />
          {fieldError("date") && <p className="text-destructive text-sm">{fieldError("date")}</p>}
        </div>

        {kind === "savings" ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="liquidity-trigger">Can it still be spent?</Label>
            <Select
              items={liquidityItems}
              value={liquidity}
              onValueChange={(value) => setLiquidity(value as SavingsLiquidity)}
            >
              <SelectTrigger id="liquidity-trigger" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {liquidityItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="category-trigger">Category</Label>
            <Select
              items={categoryItems}
              value={categoryId}
              onValueChange={(value) => setCategoryId(String(value))}
            >
              <SelectTrigger id="category-trigger" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="description">Note</Label>
          <Input
            id="description"
            name="description"
            placeholder="Optional"
            maxLength={255}
            defaultValue={transaction?.description ?? ""}
          />
          {fieldError("description") && (
            <p className="text-destructive text-sm">{fieldError("description")}</p>
          )}
        </div>

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
            {pending ? "Saving..." : isEditing ? "Save changes" : `Add ${noun}`}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

interface TransactionFormDialogProps {
  kind: TransactionKind;
  categories: Category[];
  baseCurrency: string;
  /** Provided when editing; absent when adding. */
  transaction?: TransactionListItem;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Add or edit a transaction.
 *
 * One component for both operations and both kinds — the only differences are
 * the wording, the action and whether an id is submitted.
 */
const TransactionFormDialog = ({
  kind,
  categories,
  baseCurrency,
  transaction,
  open,
  onOpenChange,
}: TransactionFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <TransactionForm
          key={transaction?.id ?? "new"}
          kind={kind}
          categories={categories}
          baseCurrency={baseCurrency}
          transaction={transaction}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default TransactionFormDialog;
