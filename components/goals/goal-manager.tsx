"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, PlusIcon, Trash2Icon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ProgressMeter from "@/components/charts/progress-meter";
import GoalContributeDialog from "@/components/goals/goal-contribute-dialog";
import GoalFormDialog from "@/components/goals/goal-form-dialog";
import { deleteGoalAction } from "@/app/actions/savings-goal.actions";
import { GoalWithProgress } from "@/lib/db/models/savings-goal.model";
import { formatMoney } from "@/lib/currency/format";
import { cn } from "@/lib/utils";

interface GoalManagerProps {
  goals: GoalWithProgress[];
  baseCurrency: string;
}

const PRIORITY_LABEL: Record<string, string> = {
  high: "High priority",
  medium: "Medium priority",
  low: "Low priority",
};

const deadlineFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * How a goal's deadline reads.
 *
 * The days figure is the point — "by 13 Nov 2026" is a fact, "92 days left" is
 * the thing that makes someone act.
 */
function deadlineText(goal: GoalWithProgress): string | null {
  if (!goal.deadline) {
    return null;
  }

  const on = deadlineFormatter.format(goal.deadline);

  if (goal.reached) {
    return `Reached · was due ${on}`;
  }

  if (goal.daysLeft === null) {
    return on;
  }

  if (goal.daysLeft < 0) {
    return `${Math.abs(goal.daysLeft)} days overdue · was due ${on}`;
  }

  if (goal.daysLeft === 0) {
    return `Due today`;
  }

  return `${goal.daysLeft} ${goal.daysLeft === 1 ? "day" : "days"} left · ${on}`;
}

/**
 * The savings goals list, with everything that acts on a goal.
 *
 * One client component holding the dialogs, following the transactions and
 * budgets pages: the page stays a Server Component and this owns which dialog
 * is open.
 */
const GoalManager = ({ goals, baseCurrency }: GoalManagerProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<GoalWithProgress | undefined>();
  // Held by id so a refresh reaches the open dialog with the current row.
  const [contributingId, setContributingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const contributing = goals.find((goal) => goal.id === contributingId);
  const deleting = goals.find((goal) => goal.id === deletingId);

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const handleDelete = () => {
    if (!deleting) {
      return;
    }

    startTransition(async () => {
      const result = await deleteGoalAction(deleting.id);

      if (result.error) {
        toast.error(result.error);
        router.refresh();
        return;
      }

      toast.success(result.success);
      setDeletingId(null);
      router.refresh();
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <p className="text-muted-foreground text-sm">
          {goals.length === 0
            ? "No goals yet"
            : `${goals.length} ${goals.length === 1 ? "goal" : "goals"}`}
        </p>

        <Button onClick={openAdd}>
          <PlusIcon />
          Add
        </Button>
      </div>

      {goals.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <div className="py-8 text-center">
            <p className="text-foreground text-sm font-medium">Nothing being saved for yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Set a target and a date, and this works out what to put aside each month.
            </p>
            <Button className="mt-4" variant="outline" onClick={openAdd}>
              Add a goal
            </Button>
          </div>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {goals.map((goal) => (
            <li key={goal.id}>
              <Card className="p-4 sm:p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-sm font-medium">{goal.name}</p>
                    <p className="text-muted-foreground mt-0.5 text-xs">
                      {PRIORITY_LABEL[goal.priority] ?? goal.priority}
                      {deadlineText(goal) && (
                        <span className={cn(goal.overdue && "text-destructive font-medium")}>
                          {" · "}
                          {deadlineText(goal)}
                        </span>
                      )}
                    </p>
                  </div>

                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Add money to ${goal.name}`}
                      onClick={() => setContributingId(goal.id)}
                    >
                      <WalletIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${goal.name}`}
                      onClick={() => {
                        setEditing(goal);
                        setFormOpen(true);
                      }}
                    >
                      <PencilIcon />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${goal.name}`}
                      onClick={() => setDeletingId(goal.id)}
                    >
                      <Trash2Icon />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex items-baseline justify-between gap-3">
                  <p className="text-foreground text-sm font-medium tabular-nums">
                    {formatMoney(goal.currentAmount, baseCurrency)}
                    <span className="text-muted-foreground font-normal">
                      {" of "}
                      {formatMoney(goal.targetAmount, baseCurrency)}
                    </span>
                  </p>

                  <p className="text-muted-foreground shrink-0 text-xs tabular-nums">
                    {Math.round(goal.ratio * 100)}%
                  </p>
                </div>

                <div className="mt-1.5">
                  <ProgressMeter
                    ratio={goal.ratio}
                    fillClassName={
                      goal.reached
                        ? "bg-emerald-500"
                        : goal.overdue
                          ? "bg-destructive"
                          : "bg-[var(--viz-income)]"
                    }
                    label={`${goal.name}: ${Math.round(goal.ratio * 100)}% of the target saved`}
                  />
                </div>

                <p className="text-muted-foreground mt-2 text-xs">
                  {goal.reached ? (
                    <span className="text-emerald-600 dark:text-emerald-500">
                      Target reached — {formatMoney(goal.currentAmount, baseCurrency)} saved.
                    </span>
                  ) : goal.perMonth ? (
                    <>
                      {formatMoney(goal.remaining, baseCurrency)} to go —{" "}
                      <span className="text-foreground font-medium">
                        {formatMoney(goal.perMonth, baseCurrency)} a month
                      </span>{" "}
                      to arrive on time.
                    </>
                  ) : goal.overdue ? (
                    <>
                      {formatMoney(goal.remaining, baseCurrency)} short at the deadline. Move the
                      date, or lower the target.
                    </>
                  ) : (
                    <>{formatMoney(goal.remaining, baseCurrency)} to go. No deadline set.</>
                  )}
                </p>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <GoalFormDialog
        goal={editing}
        baseCurrency={baseCurrency}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      {contributing && (
        <GoalContributeDialog
          goal={contributing}
          baseCurrency={baseCurrency}
          open
          onOpenChange={(open) => !open && setContributingId(null)}
        />
      )}

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeletingId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete this goal?</DialogTitle>
              <DialogDescription>
                {deleting.name} and the {formatMoney(deleting.currentAmount, baseCurrency)} recorded
                against it will be removed.
              </DialogDescription>
            </DialogHeader>

            <p className="text-muted-foreground text-sm">
              A goal is a target, not an account — no expenses or income are affected, and no money
              moves anywhere.
            </p>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setDeletingId(null)}
              >
                Cancel
              </Button>
              <Button type="button" variant="destructive" disabled={pending} onClick={handleDelete}>
                {pending ? "Deleting..." : "Delete goal"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default GoalManager;
