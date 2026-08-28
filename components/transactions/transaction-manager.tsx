"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PlusIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import TransactionFormDialog from "@/components/transactions/transaction-form-dialog";
import TransactionList from "@/components/transactions/transaction-list";
import { deleteTransactionAction } from "@/app/actions/transaction.actions";
import { formatMoney } from "@/lib/currency/format";
import { Category } from "@/lib/db/models/category.model";
import {
  TransactionKind,
  TransactionListItem,
  TransactionPage,
} from "@/lib/db/models/transaction.model";

interface TransactionManagerProps {
  kind: TransactionKind;
  page: TransactionPage;
  total: string;
  categories: Category[];
  baseCurrency: string;
  showAuthor: boolean;
  /** See {@link TransactionList} — decides which rows are read-only here. */
  activeSpaceId: string;
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
 */
const TransactionManager = ({
  kind,
  page,
  total,
  categories,
  baseCurrency,
  showAuthor,
  activeSpaceId,
  basePath,
  query,
  hasFilters,
}: TransactionManagerProps) => {
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<TransactionListItem | undefined>();
  const [busyId, setBusyId] = useState<number | null>(null);
  const [, startTransition] = useTransition();

  const noun = kind === "expense" ? "expense" : "income";
  const pageCount = Math.max(1, Math.ceil(page.total / page.pageSize));

  const openAdd = () => {
    setEditing(undefined);
    setDialogOpen(true);
  };

  const openEdit = (transaction: TransactionListItem) => {
    setEditing(transaction);
    setDialogOpen(true);
  };

  const handleDelete = (transaction: TransactionListItem) => {
    const label = transaction.description || transaction.categoryName || "this entry";

    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) {
      return;
    }

    setBusyId(transaction.id);

    startTransition(async () => {
      const result = await deleteTransactionAction(kind, transaction.id);

      setBusyId(null);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(result.success);
      router.refresh();
    });
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

  return (
    <>
      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-muted-foreground text-xs">
              {hasFilters ? "Filtered total" : "Total"}
            </p>
            <p className="text-foreground text-2xl font-semibold tabular-nums">
              {formatMoney(total, baseCurrency)}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs">
              {page.total} {page.total === 1 ? "entry" : "entries"}
            </p>
          </div>

          <Button onClick={openAdd}>
            <PlusIcon />
            Add {noun}
          </Button>
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        {page.items.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-foreground text-sm font-medium">
              {hasFilters ? `No ${noun} matches those filters` : `No ${noun} recorded yet`}
            </p>
            <p className="text-muted-foreground mt-1 text-sm">
              {hasFilters
                ? "Try widening the date range or clearing the filters."
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
              items={page.items}
              baseCurrency={baseCurrency}
              showAuthor={showAuthor}
              activeSpaceId={activeSpaceId}
              busyId={busyId}
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
                    render={page.page > 1 ? <Link href={pageHref(page.page - 1)} /> : undefined}
                  >
                    Previous
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page.page >= pageCount}
                    nativeButton={page.page >= pageCount}
                    render={
                      page.page < pageCount ? <Link href={pageHref(page.page + 1)} /> : undefined
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
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
};

export default TransactionManager;
