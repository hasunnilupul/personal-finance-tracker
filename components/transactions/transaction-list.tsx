"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/currency/format";
import { TransactionKind, TransactionListItem } from "@/lib/db/models/transaction.model";
import { cn } from "@/lib/utils";

interface TransactionListProps {
  kind: TransactionKind;
  items: TransactionListItem[];
  baseCurrency: string;
  /** Shared spaces show who added each entry; a personal one has one author. */
  showAuthor: boolean;
  busyId: number | null;
  onEdit: (transaction: TransactionListItem) => void;
  onDelete: (transaction: TransactionListItem) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/**
 * The rows of a transaction list.
 *
 * One row layout for every screen size — the secondary details wrap under the
 * description rather than living in columns that would have to collapse.
 */
const TransactionList = ({
  kind,
  items,
  baseCurrency,
  showAuthor,
  busyId,
  onEdit,
  onDelete,
}: TransactionListProps) => {
  return (
    <ul className="divide-border divide-y">
      {items.map((item) => {
        const isConverted = item.currency !== baseCurrency;
        const busy = busyId === item.id;

        return (
          <li
            key={item.id}
            className={cn(
              "flex items-start justify-between gap-3 py-3 transition-opacity",
              busy && "opacity-50",
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-base"
                style={{ backgroundColor: `${item.categoryColor ?? "#94a3b8"}33` }}
              >
                {item.categoryIcon ?? "•"}
              </span>

              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {item.description || item.categoryName || "Untitled"}
                </p>

                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {dateFormatter.format(item.date)}
                  {item.categoryName && ` · ${item.categoryName}`}
                  {showAuthor && item.createdByName && ` · ${item.createdByName}`}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <div className="text-right">
                <p
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    kind === "income" ? "text-emerald-600" : "text-foreground",
                  )}
                >
                  {kind === "income" ? "+" : "−"}
                  {formatMoney(item.baseAmount, baseCurrency)}
                </p>

                {isConverted && (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatMoney(item.amount, item.currency)}
                  </p>
                )}
              </div>

              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Edit"
                disabled={busy}
                onClick={() => onEdit(item)}
              >
                <PencilIcon />
              </Button>

              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete"
                disabled={busy}
                onClick={() => onDelete(item)}
              >
                <Trash2Icon />
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default TransactionList;
