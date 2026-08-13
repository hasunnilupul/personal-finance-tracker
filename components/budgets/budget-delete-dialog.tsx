"use client";

import { useTransition } from "react";
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
import { deleteBudgetAction } from "@/app/actions/budget.actions";
import { BudgetWithProgress } from "@/lib/db/models/budget.model";
import { formatMoney } from "@/lib/currency/format";

interface BudgetDeleteDialogProps {
  budget: BudgetWithProgress;
  baseCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Confirms removing a limit.
 *
 * A plain confirmation, unlike the category dialog: a budget owns no rows, so
 * deleting one destroys the limit and nothing else. The spending it was
 * measuring stays exactly where it was, which is worth saying outright — the
 * category dialog has trained the reader to expect a warning here.
 */
const BudgetDeleteDialog = ({
  budget,
  baseCurrency,
  open,
  onOpenChange,
}: BudgetDeleteDialogProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const name = budget.categoryName ?? "Uncategorised";

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteBudgetAction(budget.id);

      if (result.error) {
        toast.error(result.error);
        router.refresh();
        return;
      }

      toast.success(result.success);
      onOpenChange(false);
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete this budget?</DialogTitle>
          <DialogDescription>
            The {budget.period} limit of {formatMoney(budget.amount, baseCurrency)} on {name} will
            be removed.
          </DialogDescription>
        </DialogHeader>

        <p className="text-muted-foreground text-sm">
          Nothing you have recorded is affected — the {formatMoney(budget.spent, baseCurrency)}{" "}
          already spent stays exactly where it is. Only the limit goes.
        </p>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
            {pending ? "Deleting..." : "Delete budget"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BudgetDeleteDialog;
