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
  CategoryFormState,
  createCategoryAction,
  updateCategoryAction,
} from "@/app/actions/category.actions";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  DEFAULT_CATEGORY_COLOR,
  DEFAULT_CATEGORY_ICON,
} from "@/constants/category-presets";
import { Category } from "@/lib/db/models/category.model";
import { cn } from "@/lib/utils";

const initialState: CategoryFormState = {};

interface CategoryFormProps {
  type: "expense" | "income";
  category?: Category;
  onDone: () => void;
}

/**
 * The form body, remounted by `key` when the category changes so the pickers
 * and any validation errors reset without syncing state in an effect.
 */
const CategoryForm = ({ type, category, onDone }: CategoryFormProps) => {
  const router = useRouter();
  const isEditing = Boolean(category);

  const [state, formAction, pending] = useActionState(
    isEditing ? updateCategoryAction : createCategoryAction,
    initialState,
  );

  const [icon, setIcon] = useState(category?.icon ?? DEFAULT_CATEGORY_ICON);
  const [color, setColor] = useState(category?.color ?? DEFAULT_CATEGORY_COLOR);

  useEffect(() => {
    if (state.success) {
      toast.success(isEditing ? "Category updated" : "Category created");
      onDone();
      router.refresh();
    }
  }, [state.success, isEditing, onDone, router]);

  const fieldError = (name: string) => state.fieldErrors?.[name];

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {isEditing ? "Edit" : "New"} {type} category
        </DialogTitle>
        <DialogDescription>
          {isEditing
            ? "Renaming affects every entry already filed under it."
            : `It will appear in the ${type} picker.`}
        </DialogDescription>
      </DialogHeader>

      <form action={formAction} className="flex flex-col gap-4">
        {category && <input type="hidden" name="id" value={category.id} />}
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="icon" value={icon} />
        <input type="hidden" name="color" value={color} />

        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-xl"
            style={{ backgroundColor: `${color}33` }}
          >
            {icon}
          </span>

          <div className="flex flex-1 flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              name="name"
              maxLength={50}
              defaultValue={category?.name ?? ""}
              placeholder="Groceries"
              required
              autoFocus
            />
          </div>
        </div>

        {fieldError("name") && <p className="text-destructive text-sm">{fieldError("name")}</p>}

        <fieldset className="flex flex-col gap-2">
          <legend className="text-foreground mb-2 text-sm font-medium">Icon</legend>

          <div className="grid grid-cols-8 gap-1">
            {CATEGORY_ICONS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Icon ${option}`}
                aria-pressed={icon === option}
                onClick={() => setIcon(option)}
                className={cn(
                  "flex size-8 items-center justify-center rounded-lg text-base transition-colors",
                  icon === option ? "bg-primary/15 ring-primary ring-2" : "hover:bg-muted",
                )}
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-foreground mb-2 text-sm font-medium">Colour</legend>

          <div className="grid grid-cols-8 gap-1">
            {CATEGORY_COLORS.map((option) => (
              <button
                key={option}
                type="button"
                aria-label={`Colour ${option}`}
                aria-pressed={color === option}
                onClick={() => setColor(option)}
                className={cn(
                  "size-8 rounded-lg transition-transform",
                  color === option && "ring-foreground scale-110 ring-2",
                )}
                style={{ backgroundColor: option }}
              />
            ))}
          </div>
        </fieldset>

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
            {pending ? "Saving..." : isEditing ? "Save changes" : "Create category"}
          </Button>
        </DialogFooter>
      </form>
    </>
  );
};

interface CategoryFormDialogProps {
  type: "expense" | "income";
  category?: Category;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CategoryFormDialog = ({ type, category, open, onOpenChange }: CategoryFormDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <CategoryForm
          key={category?.id ?? `new-${type}`}
          type={type}
          category={category}
          onDone={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CategoryFormDialog;
