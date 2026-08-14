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
  createGoalAction,
  GoalFormState,
  updateGoalAction,
} from "@/app/actions/savings-goal.actions";
import { GoalWithProgress } from "@/lib/db/models/savings-goal.model";
import { GoalPriority } from "@/lib/services/savings-goal.service";

const initialState: GoalFormState = {};

const PRIORITY_LABEL: Record<GoalPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

interface GoalFormProps {
  goal?: GoalWithProgress;
  baseCurrency: string;
  onDone: () => void;
}

/**
 * The form body, split out so the dialog can remount it with a `key` when the
 * goal being edited changes — resetting the fields without syncing state in an
 * effect, which `react-hooks/set-state-in-effect` would fail lint over.
 */
const GoalForm = ({ goal, baseCurrency, onDone }: GoalFormProps) => {
  const router = useRouter();
  const isEditing = Boolean(goal);

  const [state, formAction, pending] = useActionState(
    isEditing ? updateGoalAction : createGoalAction,
    initialState,
  );

  const [priority, setPriority] = useState<GoalPriority>(
    (goal?.priority as GoalPriority) ?? "medium",
  );

  useEffect(() => {
    if (state.success) {
      toast.success(isEditing ? "Goal updated" : "Goal created");
      onDone();
      router.refresh();
    }
  }, [state.success, isEditing, onDone, router]);

  const fieldError = (name: string) => state.fieldErrors?.[name];

  // `items` is what makes the trigger show a label rather than the raw value the
  // form posts — see Gotchas.
  const priorityItems = (Object.keys(PRIORITY_LABEL) as GoalPriority[]).map((option) => ({
    value: option,
    label: PRIORITY_LABEL[option],
  }));

  return (
    <>
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit goal" : "New savings goal"}</DialogTitle>
        <DialogDescription>
          A target in {baseCurrency}. A deadline is optional, but it is what turns a target into a
          monthly figure.
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        {goal && <input type="hidden" name="id" value={goal.id} />}
        <input type="hidden" name="priority" value={priority} />

        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-name">Name</Label>
          <Input
            id="goal-name"
            name="name"
            placeholder="Emergency fund"
            defaultValue={goal?.name ?? ""}
            required
            autoFocus
          />
          {fieldError("name") && <p className="text-destructive text-sm">{fieldError("name")}</p>}
        </div>

        <div className="flex gap-2">
          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="goal-target">Target</Label>
            <Input
              id="goal-target"
              name="targetAmount"
              inputMode="decimal"
              placeholder="0.00"
              defaultValue={goal?.targetAmount ?? ""}
              required
            />
          </div>

          <div className="flex w-32 flex-col gap-2">
            <Label htmlFor="goal-priority">Priority</Label>
            <Select
              items={priorityItems}
              value={priority}
              onValueChange={(value) => setPriority(String(value) as GoalPriority)}
            >
              <SelectTrigger id="goal-priority" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {priorityItems.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {fieldError("targetAmount") && (
          <p className="text-destructive text-sm">{fieldError("targetAmount")}</p>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="goal-deadline">Deadline (optional)</Label>
          <Input
            id="goal-deadline"
            name="deadline"
            type="date"
            defaultValue={goal?.deadline ? goal.deadline.toISOString().slice(0, 10) : ""}
          />
          {fieldError("deadline") && (
            <p className="text-destructive text-sm">{fieldError("deadline")}</p>
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
            {pending ? "Saving..." : isEditing ? "Save changes" : "Create goal"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

interface GoalFormDialogProps {
  goal?: GoalWithProgress;
  baseCurrency: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GoalFormDialog = ({ goal, baseCurrency, open, onOpenChange }: GoalFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <GoalForm
          key={goal?.id ?? "new"}
          goal={goal}
          baseCurrency={baseCurrency}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default GoalFormDialog;
