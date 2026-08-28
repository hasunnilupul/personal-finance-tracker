"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseIcon, PencilIcon, PlayIcon, PlusIcon, RefreshCwIcon, Trash2Icon } from "lucide-react";
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
import RecurringFormDialog from "@/components/recurring/recurring-form-dialog";
import {
  deleteRecurringAction,
  runCatchUpAction,
  setRecurringActiveAction,
} from "@/app/actions/recurring.actions";
import { RecurringWithCategory } from "@/lib/repositories/recurring-transaction.repository";
import { Category } from "@/lib/db/models/category.model";
import { FREQUENCY_LABEL, Frequency } from "@/lib/recurring/schedule";
import { formatMoney } from "@/lib/currency/format";
import { cn } from "@/lib/utils";

interface RecurringManagerProps {
  templates: RecurringWithCategory[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  /** See {@link RecurringFormProps.allowIncome}. */
  allowIncome: boolean;
  baseCurrency: string;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * When the next entry lands, in the terms someone reads it in.
 */
function nextText(template: RecurringWithCategory, today: Date): string {
  if (!template.isActive) {
    return "Paused";
  }

  const on = dateFormatter.format(template.nextDate);
  const days = Math.round(
    (Date.UTC(
      template.nextDate.getUTCFullYear(),
      template.nextDate.getUTCMonth(),
      template.nextDate.getUTCDate(),
    ) -
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) /
      86_400_000,
  );

  if (days < 0) {
    return `Due — will be added on the next visit`;
  }

  if (days === 0) {
    return `Due today`;
  }

  return `Next on ${on}${days <= 31 ? ` · in ${days} ${days === 1 ? "day" : "days"}` : ""}`;
}

/**
 * The recurring templates list, with everything that acts on one.
 *
 * The page catches up on load, so the figures here are already current. "Run
 * now" exists for the case where someone wants to watch it happen — and as the
 * hand-operated version of the cron sweep, which cannot run unless
 * `CRON_SECRET` is configured.
 */
const RecurringManager = ({
  templates,
  expenseCategories,
  incomeCategories,
  allowIncome,
  baseCurrency,
}: RecurringManagerProps) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringWithCategory | undefined>();
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const deleting = templates.find((template) => template.id === deletingId);
  const today = new Date();

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const toggleActive = (template: RecurringWithCategory) => {
    setBusyId(template.id);

    startTransition(async () => {
      const result = await setRecurringActiveAction(template.id, !template.isActive);

      setBusyId(null);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
      }

      router.refresh();
    });
  };

  const runNow = () => {
    startTransition(async () => {
      const result = await runCatchUpAction();

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.success);
      }

      router.refresh();
    });
  };

  const handleDelete = () => {
    if (!deleting) {
      return;
    }

    startTransition(async () => {
      const result = await deleteRecurringAction(deleting.id);

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
          {templates.length === 0
            ? "No templates yet"
            : `${templates.length} ${templates.length === 1 ? "template" : "templates"}`}
        </p>

        <div className="flex items-center gap-2">
          <Button variant="outline" disabled={pending} onClick={runNow}>
            <RefreshCwIcon />
            Run now
          </Button>
          <Button onClick={openAdd}>
            <PlusIcon />
            Add
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card className="p-4 sm:p-6">
          <div className="py-8 text-center">
            <p className="text-foreground text-sm font-medium">Nothing repeating yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              Rent, a salary, a subscription — set it once and the entries appear on their own.
            </p>
            <Button className="mt-4" variant="outline" onClick={openAdd}>
              Add a recurring entry
            </Button>
          </div>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {templates.map((template) => {
            const busy = busyId === template.id;
            const isIncome = template.type === "income";

            return (
              <li key={template.id}>
                <Card className={cn("p-4 transition-opacity sm:p-5", busy && "opacity-50")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span
                        aria-hidden
                        className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-base"
                        style={{ backgroundColor: `${template.categoryColor ?? "#94a3b8"}33` }}
                      >
                        {template.categoryIcon ?? "•"}
                      </span>

                      <div className="min-w-0">
                        <p className="text-foreground truncate text-sm font-medium">
                          {template.description || template.categoryName || "Untitled"}
                        </p>
                        <p className="text-muted-foreground mt-0.5 truncate text-xs">
                          {FREQUENCY_LABEL[template.frequency as Frequency] ?? template.frequency}
                          {template.categoryName && ` · ${template.categoryName}`}
                          {template.endDate && ` · until ${dateFormatter.format(template.endDate)}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <div className="text-right">
                        <p
                          className={cn(
                            "text-sm font-semibold tabular-nums",
                            isIncome ? "text-emerald-600 dark:text-emerald-500" : "text-foreground",
                          )}
                        >
                          {isIncome ? "+" : "−"}
                          {formatMoney(template.amount, template.currency)}
                        </p>
                      </div>

                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={template.isActive ? "Pause" : "Resume"}
                        disabled={pending}
                        onClick={() => toggleActive(template)}
                      >
                        {template.isActive ? <PauseIcon /> : <PlayIcon />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Edit"
                        disabled={pending}
                        onClick={() => {
                          setEditing(template);
                          setFormOpen(true);
                        }}
                      >
                        <PencilIcon />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Delete"
                        disabled={pending}
                        onClick={() => setDeletingId(template.id)}
                      >
                        <Trash2Icon />
                      </Button>
                    </div>
                  </div>

                  <p
                    className={cn(
                      "text-muted-foreground mt-2 text-xs",
                      !template.isActive && "italic",
                    )}
                  >
                    {nextText(template, today)}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <RecurringFormDialog
        template={editing}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        allowIncome={allowIncome}
        baseCurrency={baseCurrency}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      {deleting && (
        <Dialog open onOpenChange={(open) => !open && setDeletingId(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete this template?</DialogTitle>
              <DialogDescription>
                {deleting.description || deleting.categoryName || "This template"} will stop
                creating entries.
              </DialogDescription>
            </DialogHeader>

            <p className="text-muted-foreground text-sm">
              The entries it has already created are kept — that money really was spent or earned.
              They simply stop being linked to this template.
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
                {pending ? "Deleting..." : "Delete template"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default RecurringManager;
