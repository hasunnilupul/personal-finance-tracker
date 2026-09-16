"use client";

import { PencilIcon, Trash2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import SpaceBadge from "@/components/transactions/space-badge";
import { formatMoney } from "@/lib/currency/format";
import { TransactionKind, TransactionListItem } from "@/lib/db/models/transaction.model";
import { cn } from "@/lib/utils";

interface TransactionListProps {
  kind: TransactionKind;
  items: TransactionListItem[];
  baseCurrency: string;
  /** Shared spaces show who added each entry; a personal one has one author. */
  showAuthor: boolean;
  /**
   * The space the page is scoped to.
   *
   * A personal ledger's expense list reaches across into the shared spaces its
   * owner spends in, so some rows here belong elsewhere. Comparing against this
   * is what tells those apart — they are badged with the space they came from,
   * and they carry no edit or delete control, because those act on the active
   * space and would refuse.
   */
  activeSpaceId: string;
  busyId: number | null;
  onEdit: (transaction: TransactionListItem) => void;
  onDelete: (transaction: TransactionListItem) => void;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

const LIQUIDITY_ICON: Record<string, string> = { liquid: "💧", locked: "🔒" };

/**
 * Sign and colour for one row's amount.
 *
 * A savings withdrawal is stored as a negative amount (see the form dialog),
 * so it reads the other way round from a normal saving: money is coming back
 * to spendable, the same direction income moves in.
 */
function amountStyle(
  kind: TransactionKind,
  baseAmount: string,
): { sign: string; className: string } {
  if (kind === "income") {
    return { sign: "+", className: "text-emerald-600" };
  }

  if (kind === "savings") {
    return Number(baseAmount) < 0
      ? { sign: "+", className: "text-emerald-600" }
      : { sign: "−", className: "text-amber-600 dark:text-amber-500" };
  }

  return { sign: "−", className: "text-foreground" };
}

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
  activeSpaceId,
  busyId,
  onEdit,
  onDelete,
}: TransactionListProps) => {
  return (
    <ul className="divide-border divide-y">
      {items.map((item) => {
        const isConverted = item.currency !== baseCurrency;
        const elsewhere = item.organizationId !== activeSpaceId;
        const busy = busyId === item.id;
        const style = amountStyle(kind, item.baseAmount);
        const fallbackIcon =
          kind === "savings" ? (LIQUIDITY_ICON[item.liquidity ?? "liquid"] ?? "•") : "•";

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
                {item.categoryIcon ?? fallbackIcon}
              </span>

              <div className="min-w-0">
                <p className="text-foreground flex items-center text-sm font-medium">
                  <span className="min-w-0 truncate">
                    {item.description || item.categoryName || "Untitled"}
                  </span>
                  {elsewhere && <SpaceBadge name={item.spaceName} />}
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
                <p className={cn("text-sm font-semibold tabular-nums", style.className)}>
                  {style.sign}
                  {formatMoney(Math.abs(Number(item.baseAmount)).toFixed(2), baseCurrency)}
                </p>

                {isConverted && (
                  <p className="text-muted-foreground text-xs tabular-nums">
                    {formatMoney(Math.abs(Number(item.amount)).toFixed(2), item.currency)}
                  </p>
                )}
              </div>

              {/*
                An entry filed in another space is read-only here. The action
                would be refused anyway — every write is scoped to the active
                space — so the choice is between a button that fails and no
                button. The badge beside the description says where to go to
                change it.
              */}
              {!elsewhere && (
                <>
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
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default TransactionList;
