"use client";

import { useMemo, useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useFilterPending } from "@/components/transactions/filter-pending";
import TransactionFormDialog from "@/components/transactions/transaction-form-dialog";
import TransactionList from "@/components/transactions/transaction-list";
import {
  createTransactionAction,
  deleteTransactionAction,
  type TransactionFormState,
  updateTransactionAction,
} from "@/app/actions/transaction.actions";
import { formatMoney } from "@/lib/currency/format";
import { Category } from "@/lib/db/models/category.model";
import {
  TransactionFilters,
  TransactionKind,
  TransactionListItem,
  TransactionPage,
} from "@/lib/db/models/transaction.model";
import {
  applyChange,
  type Change,
  type ChangeContext,
  type Draft,
  type OptimisticView,
  parseDraft,
} from "@/lib/transactions/optimistic";

/** What a save that never reached the server says, in place of a crash. */
const OFFLINE_MESSAGE = "Could not reach the server. Check your connection and try again.";

interface TransactionManagerProps {
  kind: TransactionKind;
  page: TransactionPage;
  total: string;
  categories: Category[];
  baseCurrency: string;
  showAuthor: boolean;
  /** See {@link TransactionList} — decides which rows are read-only here. */
  activeSpaceId: string;
  /** What the list was asked for — needed to tell whether a new row belongs in it. */
  filters: TransactionFilters;
  basePath: string;
  query: string;
  hasFilters: boolean;
}

/**
 * Owns the interactive parts of a transaction page: the add/edit dialog, the
 * delete confirmation and pagination links.
 *
 * The list itself is rendered from data the Server Component fetched, so a
 * filter change is a navigation rather than a client-side refetch.
 *
 * **Writes show up before the server has answered, when that can be done
 * honestly.** `applyChange` works out what the list will look like; where it
 * cannot be sure — a foreign currency, a search, a later page — it says so and the
 * write takes the ordinary path, waiting for the server. If a write fails the page
 * puts itself back, and the entry comes back to the form to try again.
 */
const TransactionManager = ({
  kind,
  page,
  total,
  categories,
  baseCurrency,
  showAuthor,
  activeSpaceId,
  filters,
  basePath,
  query,
  hasFilters,
}: TransactionManagerProps) => {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionListItem | undefined>();
  const [prefill, setPrefill] = useState<Draft | undefined>();
  const [, startTransition] = useTransition();
  const { start: startNavigation } = useFilterPending();

  const changeContext: ChangeContext = {
    kind,
    baseCurrency,
    activeSpaceId,
    categories,
    filters,
  };

  const serverView = useMemo<OptimisticView>(
    () => ({
      items: page.items,
      total,
      count: page.total,
      page: page.page,
      pageSize: page.pageSize,
    }),
    [page, total],
  );

  const [view, addOptimistic] = useOptimistic(
    serverView,
    (current, change: Change) => applyChange(current, change, changeContext) ?? current,
  );

  const noun = kind === "expense" ? "expense" : kind === "income" ? "income" : "saving";
  const pageCount = Math.max(1, Math.ceil(view.count / view.pageSize));

  const openAdd = () => {
    setEditing(undefined);
    setPrefill(undefined);
    setDialogOpen(true);
  };

  const openEdit = (transaction: TransactionListItem) => {
    setEditing(transaction);
    setPrefill(undefined);
    setDialogOpen(true);
  };

  const handleDelete = (transaction: TransactionListItem) => {
    const label = transaction.description || transaction.categoryName || "this entry";

    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }

    const change: Change = { type: "delete", id: transaction.id };

    startTransition(async () => {
      // Always knowable: the row goes, and its amount comes off the total. If the
      // delete fails the transition ends without the server's data having
      // changed, and the row reappears on its own.
      addOptimistic(change);

      const result = await deleteTransactionAction(kind, transaction.id).catch(() => ({
        error: OFFLINE_MESSAGE,
        success: undefined,
      }));

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
    });
  };

  /**
   * Takes a save over from the form, if the page can show it honestly.
   *
   * The dialog closes and the row appears at once; the action then runs, and if it
   * fails the page puts itself back and offers the entry again. It only goes this
   * way when the form would not have come back with a field error (`parseDraft`
   * mirrors the server's parsing) and the effect on the list is known.
   *
   * @returns `true` if it took over, `false` to leave the ordinary path to run.
   */
  const submitOptimistically = (formData: FormData): boolean => {
    const draft = parseDraft(formData);

    if (!draft) {
      return false;
    }

    const change: Change = editing
      ? { type: "update", id: editing.id, draft }
      : { type: "create", tempId: -Date.now(), draft };

    // Asked against what is on screen now, including any earlier write still in
    // flight, which is what the next one would be applied to.
    if (!applyChange(view, change, changeContext)) {
      return false;
    }

    const saving = editing;

    setDialogOpen(false);

    startTransition(async () => {
      addOptimistic(change);

      // A dropped connection rejects rather than returning an error, and an
      // unhandled rejection here would reach the error boundary instead of the
      // person. It is a failed save like any other.
      const result: TransactionFormState = await (
        saving ? updateTransactionAction : createTransactionAction
      )({}, formData).catch(() => ({ error: OFFLINE_MESSAGE }));

      if (result.success) {
        toast.success(saving ? "Entry updated" : "Entry added");
        return;
      }

      const message =
        result.error ??
        Object.values(result.fieldErrors ?? {})[0] ??
        (saving ? "Could not save that change." : "Could not save that entry.");

      toast.error(message, {
        duration: 10_000,
        action: {
          label: "Edit again",
          onClick: () => {
            setEditing(saving);
            setPrefill(draft);
            setDialogOpen(true);
          },
        },
      });
    });

    return true;
  };

  const pageHref = (target: number) => {
    const params = new URLSearchParams(query);

    if (target <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(target));
    }

    const search = params.toString();

    return search ? `${basePath}?${search}` : basePath;
  };

  // Taken over from the link so the list can grey out while the next page loads.
  // `onNavigate` only fires for a plain click, which leaves middle-click and
  // open-in-new-tab to the browser, exactly as before.
  const goToPage = (event: { preventDefault: () => void }, target: number) => {
    event.preventDefault();
    startNavigation(() => router.push(pageHref(target)));
  };

  return (
    <>
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs">
              {hasFilters ? "Filtered total" : "Total"}
            </p>
            <p className="text-foreground text-2xl font-semibold tabular-nums">
              {formatMoney(view.total, baseCurrency)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {view.count} {view.count === 1 ? "entry" : "entries"}
            </p>
          </div>

          <Button onClick={openAdd}>
            <PlusIcon />
            Add {noun}
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        {view.items.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-foreground text-sm font-medium">
              {hasFilters ? `No ${noun} matches those filters` : `No ${noun} recorded yet`}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {hasFilters
                ? "Try widening the date range, or changing the search and filters."
                : `Add your first ${noun} to start tracking.`}
            </p>

            {!hasFilters && (
              <Button className="mt-4" onClick={openAdd}>
                <PlusIcon />
                Add {noun}
              </Button>
            )}
          </div>
        ) : (
          <>
            <TransactionList
              kind={kind}
              items={view.items}
              baseCurrency={baseCurrency}
              showAuthor={showAuthor}
              activeSpaceId={activeSpaceId}
              onEdit={openEdit}
              onDelete={handleDelete}
            />

            {pageCount > 1 && (
              <div className="mt-4 flex items-center justify-between">
                <p className="text-muted-foreground text-xs">
                  Page {page.page} of {pageCount}
                </p>

                <div className="flex gap-2">
                  {/*
                    `nativeButton` tracks what `render` produced: an anchor when
                    there is a page to go to, a real <button> when there is not.
                    See Gotchas.
                  */}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page.page <= 1}
                    nativeButton={page.page <= 1}
                    render={
                      page.page > 1 ? (
                        <Link
                          href={pageHref(page.page - 1)}
                          onNavigate={(event) => goToPage(event, page.page - 1)}
                        />
                      ) : undefined
                    }
                  >
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page.page >= pageCount}
                    nativeButton={page.page >= pageCount}
                    render={
                      page.page < pageCount ? (
                        <Link
                          href={pageHref(page.page + 1)}
                          onNavigate={(event) => goToPage(event, page.page + 1)}
                        />
                      ) : undefined
                    }
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>

      <TransactionFormDialog
        kind={kind}
        categories={categories}
        baseCurrency={baseCurrency}
        transaction={editing}
        prefill={prefill}
        onOptimisticSubmit={submitOptimistically}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};

export default TransactionManager;
