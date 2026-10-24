"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { SearchIcon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFilterPending } from "@/components/transactions/filter-pending";
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
  /** False for savings, which is never categorised. Defaults to `true`. */
  showCategoryFilter?: boolean;
  /** The range the page opens on, which "Clear" returns to. Empty for no default. */
  defaults: { from?: string; to?: string };
  current: {
    from?: string;
    to?: string;
    categoryId?: string;
    createdBy?: string;
    search?: string;
  };
}

const ANY = "any";

/** How long typing has to pause before the list is asked for. */
const SEARCH_DELAY_MS = 350;

/**
 * Filter bar for a transaction list.
 *
 * Filters live in the URL rather than component state, so a filtered view can
 * be bookmarked, shared and survives a refresh — and the page stays a Server
 * Component that reads `searchParams`.
 *
 * The three text-like inputs (both dates and the search box) do keep a local
 * copy of what was typed. The URL is the source of truth for the list, but a
 * "Clear" has to be able to put the inputs back, and an uncontrolled input that
 * has been typed in ignores a changed `defaultValue`.
 */
const TransactionFilters = ({
  basePath,
  categories,
  authors,
  showAuthorFilter,
  showCategoryFilter = true,
  defaults,
  current,
}: TransactionFiltersProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { start } = useFilterPending();

  const [from, setFrom] = useState(current.from ?? "");
  const [to, setTo] = useState(current.to ?? "");
  const [search, setSearch] = useState(current.search ?? "");
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(searchTimer.current), []);

  const apply = useCallback(
    (updates: Record<string, string | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());

      for (const [key, value] of Object.entries(updates)) {
        if (key === "from" || key === "to") {
          // Kept even when empty: a missing date means "use the default
          // month", an empty one means "no limit on this end".
          params.set(key, value ?? "");
        } else if (!value || value === ANY) {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      // Any filter change invalidates the current page number.
      params.delete("page");

      const query = params.toString();

      start(() => router.push(query ? `${basePath}?${query}` : basePath));
    },
    [basePath, router, searchParams, start],
  );

  // Both ends are written every time. Changing only one would leave the other
  // out of the URL, and the page would read that as "the default month".
  const applyDates = (nextFrom: string, nextTo: string) => {
    setFrom(nextFrom);
    setTo(nextTo);
    apply({ from: nextFrom, to: nextTo });
  };

  const onSearchChange = (value: string) => {
    setSearch(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => apply({ search: value.trim() }), SEARCH_DELAY_MS);
  };

  const onSearchSubmit = (event: FormEvent) => {
    event.preventDefault();
    clearTimeout(searchTimer.current);
    apply({ search: search.trim() });
  };

  const clear = () => {
    clearTimeout(searchTimer.current);
    setFrom(defaults.from ?? "");
    setTo(defaults.to ?? "");
    setSearch("");
    start(() => router.push(basePath));
  };

  const hasFilters = Boolean(
    (current.from ?? "") !== (defaults.from ?? "") ||
    (current.to ?? "") !== (defaults.to ?? "") ||
    current.categoryId ||
    current.createdBy ||
    current.search,
  );

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
      <form
        role="search"
        className="flex min-w-48 flex-1 flex-col gap-1.5 sm:max-w-xs"
        onSubmit={onSearchSubmit}
      >
        <Label htmlFor="filter-search" className="text-xs">
          Search
        </Label>
        <div className="relative">
          <SearchIcon
            aria-hidden
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
          />
          <Input
            id="filter-search"
            type="search"
            className="pl-8"
            placeholder="Note or category"
            autoComplete="off"
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
          />
        </div>
      </form>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="from" className="text-xs">
          From
        </Label>
        <Input
          id="from"
          type="date"
          className="w-40"
          value={from}
          onChange={(event) => applyDates(event.target.value, to)}
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
          value={to}
          onChange={(event) => applyDates(from, event.target.value)}
        />
      </div>

      {showCategoryFilter && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-category" className="text-xs">
            Category
          </Label>
          <Select
            items={categoryItems}
            value={current.categoryId ?? ANY}
            onValueChange={(value) => apply({ categoryId: String(value) })}
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
      )}

      {showAuthorFilter && authors.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="filter-author" className="text-xs">
            Added by
          </Label>
          <Select
            items={authorItems}
            value={current.createdBy ?? ANY}
            onValueChange={(value) => apply({ createdBy: String(value) })}
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
        <Button variant="ghost" size="sm" onClick={clear}>
          <XIcon />
          Clear
        </Button>
      )}
    </div>
  );
};

export default TransactionFilters;
