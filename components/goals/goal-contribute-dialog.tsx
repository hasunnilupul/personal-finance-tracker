"use client";

import { useState, useTransition } from "react";
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
import { contributeAction } from "@/app/actions/savings-goal.actions";
import { GoalWithProgress } from "@/lib/db/models/savings-goal.model";
import { formatMoney } from "@/lib/currency/format";

interface GoalContributeDialogProps {
  goal: GoalWithProgress;
  baseCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Moves money into or out of a goal.
 *
 * Two buttons rather than a signed amount: "add" and "take out" is how people
 * describe it, and a minus sign typed into an amount field is easy to miss.
 * The direction is a separate argument for the same reason on the server.
 */
const GoalContributeDialog = ({
  goal,
  baseCurrency,
  open,
  onOpenChange,
}: GoalContributeDialogProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | undefined>();

  const submit = (withdraw: boolean) => {
    setError(undefined);

    startTransition(async () => {
      const result = await contributeAction(goal.id, amount, withdraw);

      if (result.error) {
        setError(result.error);
        return;
      }

      toast.success(result.success);
      onOpenChange(false);
      setAmount("");
      router.refresh();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{goal.name}</DialogTitle>
          <DialogDescription>
            {formatMoney(goal.currentAmount, baseCurrency)} saved of{" "}
            {formatMoney(goal.targetAmount, baseCurrency)}.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2">
          <Label htmlFor="contribution">Amount</Label>
          <Input
            id="contribution"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            autoFocus
          />
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending || !amount}
            onClick={() => submit(true)}
          >
            Take out
          </Button>
          <Button type="button" disabled={pending || !amount} onClick={() => submit(false)}>
            {pending ? "Saving..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GoalContributeDialog;
