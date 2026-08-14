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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { deleteCategoryAction } from "@/app/actions/category.actions";
import { CategoryWithUsage } from "@/lib/db/models/category.model";

interface CategoryDeleteDialogProps {
  category: CategoryWithUsage;
  /** Same-type categories the entries could move to, excluding this one. */
  alternatives: CategoryWithUsage[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Spells out what a category still holds before it goes.
 *
 * Deleting one that is in use is refused by the service unless a replacement
 * is named, so this dialog's job is to make that replacement easy to pick —
 * and to be explicit that budgets do not move with the entries, they are
 * deleted.
 */
const CategoryDeleteBody = ({
  category,
  alternatives,
  onOpenChange,
}: Omit<CategoryDeleteDialogProps, "open">) => {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Null rather than "" — this Select reports "nothing chosen" as null.
  const [reassignToId, setReassignToId] = useState<string | null>(null);

  const { usage } = category;
  const inUse = usage.reassignable > 0;
  const needsTarget = inUse && !reassignToId;
  const stranded = inUse && alternatives.length === 0;

  const handleDelete = () => {
    startTransition(async () => {
      const result = await deleteCategoryAction(
        category.id,
        reassignToId ? Number(reassignToId) : undefined,
      );

      if (result.error) {
        toast.error(result.error);
        // The counts came from the last render. If someone else has filed an
        // entry here since, the service refuses — pull the fresh numbers in so
        // the picker appears rather than leaving the same dead button.
        router.refresh();
        return;
      }

      toast.success(result.success);
      onOpenChange(false);
      router.refresh();
    });
  };

  const counts = [
    { label: usage.expenses === 1 ? "expense" : "expenses", value: usage.expenses },
    { label: "income entries", value: usage.income },
    {
      label: usage.recurring === 1 ? "recurring template" : "recurring templates",
      value: usage.recurring,
    },
  ].filter((entry) => entry.value > 0);

  // `items` is what makes the trigger show a category's name rather than the id
  // it reassigns to — see Gotchas.
  const alternativeItems = alternatives.map((option) => ({
    value: String(option.id),
    label: `${option.icon} ${option.name}`,
  }));

  return (
    <>
      <DialogHeader>
        <DialogTitle>Delete {category.name}?</DialogTitle>
        <DialogDescription>
          {inUse
            ? "This category is still in use. Choose where its entries should go."
            : "Nothing is filed under this category, so it can go straight away."}
        </DialogDescription>
      </DialogHeader>

      <div className="flex flex-col gap-4">
        {counts.length > 0 && (
          <ul className="text-muted-foreground flex flex-col gap-1 text-sm">
            {counts.map((entry) => (
              <li key={entry.label}>
                <span className="text-foreground font-medium tabular-nums">{entry.value}</span>{" "}
                {entry.label}
              </li>
            ))}
          </ul>
        )}

        {usage.budgets > 0 && (
          <p className="border-destructive/40 bg-destructive/5 text-foreground rounded-lg border p-3 text-sm">
            <span className="font-medium tabular-nums">{usage.budgets}</span>{" "}
            {usage.budgets === 1 ? "budget" : "budgets"} set against this category will be deleted
            with it — a spending limit for a category that no longer exists means nothing. That part
            cannot be moved.
          </p>
        )}

        {stranded ? (
          <p className="text-muted-foreground text-sm">
            There is no other {category.type} category to move them to. Create one first, then
            delete this.
          </p>
        ) : (
          inUse && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="reassignToId">Move entries to</Label>

              <Select items={alternativeItems} value={reassignToId} onValueChange={setReassignToId}>
                <SelectTrigger id="reassignToId">
                  <SelectValue placeholder="Pick a category" />
                </SelectTrigger>
                <SelectContent>
                  {alternativeItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        )}
      </div>

      <DialogFooter>
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => onOpenChange(false)}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant="destructive"
          disabled={pending || needsTarget}
          onClick={handleDelete}
        >
          {pending ? "Deleting..." : "Delete category"}
        </Button>
      </DialogFooter>
    </>
  );
};

const CategoryDeleteDialog = ({
  category,
  alternatives,
  open,
  onOpenChange,
}: CategoryDeleteDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {/* Remounted per category so a previously chosen target never carries over. */}
        <CategoryDeleteBody
          key={category.id}
          category={category}
          alternatives={alternatives}
          onOpenChange={onOpenChange}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CategoryDeleteDialog;
