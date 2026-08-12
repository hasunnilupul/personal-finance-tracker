"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import CategoryDeleteDialog from "@/components/categories/category-delete-dialog";
import CategoryFormDialog from "@/components/categories/category-form-dialog";
import CategoryList from "@/components/categories/category-list";
import { addDefaultCategoriesAction } from "@/app/actions/category.actions";
import { CategoryWithUsage } from "@/lib/db/models/category.model";

interface CategorySectionProps {
  type: "expense" | "income";
  categories: CategoryWithUsage[];
}

/**
 * One type's categories, with everything needed to manage them.
 *
 * Expense and income are shown as two sections on one page rather than as
 * tabs: a household has a couple of dozen categories in total, and seeing
 * both at once is what makes it obvious which side a category belongs to.
 */
const CategorySection = ({ type, categories }: CategorySectionProps) => {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CategoryWithUsage | undefined>();
  // Held by id, not by value: the row is looked up in the current list on every
  // render, so a refresh after a refused delete reaches the open dialog with
  // fresh counts instead of leaving it on the numbers it opened with.
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [restoring, startRestore] = useTransition();

  const heading = type === "expense" ? "Expense categories" : "Income categories";
  const deleting = categories.find((category) => category.id === deletingId);

  const openAdd = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (category: CategoryWithUsage) => {
    setEditing(category);
    setFormOpen(true);
  };

  const restoreDefaults = () => {
    startRestore(async () => {
      const result = await addDefaultCategoriesAction(type);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      router.refresh();
    });
  };

  return (
    <>
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-foreground text-lg font-semibold tracking-tight">{heading}</h2>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {categories.length} {categories.length === 1 ? "category" : "categories"} in the{" "}
              {type} picker
            </p>
          </div>

          <Button onClick={openAdd}>
            <PlusIcon />
            Add
          </Button>
        </div>

        {categories.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-foreground text-sm font-medium">No {type} categories yet</p>
            <p className="text-muted-foreground mt-1 text-sm">
              The {type} picker is empty until there is at least one.
            </p>

            <Button
              className="mt-4"
              variant="outline"
              disabled={restoring}
              onClick={restoreDefaults}
            >
              {restoring ? "Adding..." : `Add the default ${type} categories`}
            </Button>
          </div>
        ) : (
          <div className="mt-2">
            <CategoryList
              categories={categories}
              onEdit={openEdit}
              onDelete={(category) => setDeletingId(category.id)}
            />
          </div>
        )}
      </Card>

      <CategoryFormDialog
        type={type}
        category={editing}
        open={formOpen}
        onOpenChange={setFormOpen}
      />

      {deleting && (
        <CategoryDeleteDialog
          category={deleting}
          alternatives={categories.filter((category) => category.id !== deleting.id)}
          open
          onOpenChange={(open) => !open && setDeletingId(null)}
        />
      )}
    </>
  );
};

export default CategorySection;
