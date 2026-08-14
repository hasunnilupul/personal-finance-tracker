"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";
import { XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Category } from "@/lib/db/models/category.model";

interface TransactionFiltersProps {
  basePath: string;
  categories: Category[];
  authors: { id: string; name: string }[];
  showAuthorFilter: boolean;
  current: {
    from?: string;
    to?: string;
    categoryId?: string;
    createdBy?: string;
  };
}

const ANY = "any";

/**
 * Filter bar for a transaction list.
 *
 * Filters live in the URL rather than component state, so a filtered view can
 * be bookmarked, shared and survives a refresh — and the page stays a Server
 * Component that reads `searchParams`.
 */
const TransactionFilters = ({
  basePath,
  categories,
  authors,
  showAuthorFilter,
  current,
}: TransactionFiltersProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();

  const apply = useCallback(
    (key: string, value: string | undefined) => {
      const params = new URLSearchParams(searchParams.toString());

      if (!value || value === ANY) {
        params.delete(key);
      } else {
        params.set(key, value);
      }

      // Any filter change invalidates the current page number.
      params.delete("page");

      const query = params.toString();

      router.push(query ? `${basePath}?${query}` : basePath);
    },
    [basePath, router, searchParams],
  );

  const hasFilters = Boolean(current.from || current.to || current.categoryId || current.createdBy);

  // `items` is what makes the trigger show a label rather than the raw id it is
  // filtering on — see Gotchas.
  const categoryItems = [
    { value: ANY, label: "All categories" },
    ...categories.map((category) => ({
      value: String(category.id),
      label: `${category.icon} ${category.name}`,
    })),
  ];

  const authorItems = [
    { value: ANY, label: "Everyone" },
    ...authors.map((author) => ({ value: author.id, label: author.name })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from" className="text-xs">
          From
        </Label>
        <Input
          id="from"
          type="date"
          className="w-40"
          defaultValue={current.from ?? ""}
          onChange={(event) => apply("from", event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="to" className="text-xs">
          To
        </Label>
        <Input
          id="to"
          type="date"
          className="w-40"
          defaultValue={current.to ?? ""}
          onChange={(event) => apply("to", event.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="filter-category" className="text-xs">
          Category
        </Label>
        <Select
          items={categoryItems}
          value={current.categoryId ?? ANY}
          onValueChange={(value) => apply("categoryId", String(value))}
        >
          <SelectTrigger id="filter-category" className="w-44">
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

      {showAuthorFilter && authors.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-author" className="text-xs">
            Added by
          </Label>
          <Select
            items={authorItems}
            value={current.createdBy ?? ANY}
            onValueChange={(value) => apply("createdBy", String(value))}
          >
            <SelectTrigger id="filter-author" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {authorItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(basePath)}>
          <XIcon />
          Clear
        </Button>
      )}
    </div>
  );
};

export default TransactionFilters;
