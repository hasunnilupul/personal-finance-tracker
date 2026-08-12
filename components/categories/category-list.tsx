"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { CategoryWithUsage } from "@/lib/db/models/category.model";

interface CategoryListProps {
  categories: CategoryWithUsage[];
  onEdit: (category: CategoryWithUsage) => void;
  onDelete: (category: CategoryWithUsage) => void;
}

/**
 * Describes what a category holds, in the order a reader cares about it.
 *
 * Budgets are named separately from entries because they are the part that a
 * delete destroys rather than moves.
 */
function usageLabel({ usage }: CategoryWithUsage): string {
  const parts: string[] = [];

  if (usage.reassignable > 0) {
    parts.push(`${usage.reassignable} ${usage.reassignable === 1 ? "entry" : "entries"}`);
  }

  if (usage.budgets > 0) {
    parts.push(`${usage.budgets} ${usage.budgets === 1 ? "budget" : "budgets"}`);
  }

  return parts.length > 0 ? parts.join(" · ") : "Not used yet";
}

const CategoryList = ({ categories, onEdit, onDelete }: CategoryListProps) => {
  return (
    <ul className="divide-border divide-y">
      {categories.map((category) => (
        <li key={category.id} className="flex items-center justify-between gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              aria-hidden
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-base"
              style={{ backgroundColor: `${category.color}33` }}
            >
              {category.icon}
            </span>

            <div className="min-w-0">
              <p className="text-foreground truncate text-sm font-medium">{category.name}</p>
              <p className="text-muted-foreground mt-0.5 truncate text-xs">
                {usageLabel(category)}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Edit ${category.name}`}
              onClick={() => onEdit(category)}
            >
              <PencilIcon />
            </Button>

            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`Delete ${category.name}`}
              onClick={() => onDelete(category)}
            >
              <Trash2Icon />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
};

export default CategoryList;
