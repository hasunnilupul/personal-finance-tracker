import Link from "next/link";

import SpaceBadge from "@/components/transactions/space-badge";
import { RecentEntry } from "@/lib/services/dashboard.service";
import { formatMoney } from "@/lib/currency/format";
import { cn } from "@/lib/utils";

interface RecentEntriesProps {
  entries: RecentEntry[];
  baseCurrency: string;
  /** Shared spaces show who added each entry; a personal one has one author. */
  showAuthor: boolean;
  /** See {@link TransactionList} — badges the rows that live somewhere else. */
  activeSpaceId: string;
  /** Only a personal space has an income page to send someone to. */
  isPersonal: boolean;
}

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
});

const LIQUIDITY_ICON: Record<string, string> = { liquid: "💧", locked: "🔒" };

/**
 * Sign and colour for one entry's amount.
 *
 * A savings withdrawal is stored as a negative amount (see the transaction
 * form), so it reads the other way round from a normal saving: money is
 * coming back to spendable, the same direction income moves in.
 */
function amountStyle(
  kind: RecentEntry["kind"],
  baseAmount: string,
): {
  sign: string;
  className: string;
} {
  if (kind === "income") {
    return { sign: "+", className: "text-emerald-600 dark:text-emerald-500" };
  }

  if (kind === "savings") {
    return Number(baseAmount) < 0
      ? { sign: "+", className: "text-emerald-600 dark:text-emerald-500" }
      : { sign: "−", className: "text-amber-600 dark:text-amber-500" };
  }

  return { sign: "−", className: "text-foreground" };
}

/**
 * The last few entries across both expenses and income.
 *
 * Read-only: the dashboard is a glance, and editing lives on the pages that own
 * each kind. The rows mirror the transaction list's layout so the two read as
 * the same thing seen from different distances — but they are a plain list
 * rather than that component, which is a client component carrying edit and
 * delete handlers this has no use for.
 */
const RecentEntries = ({
  entries,
  baseCurrency,
  showAuthor,
  activeSpaceId,
  isPersonal,
}: RecentEntriesProps) => {
  if (entries.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-foreground text-sm font-medium">Nothing recorded yet</p>
        <p className="text-muted-foreground mt-1 text-sm">
          Add an{" "}
          <Link href="/expenses" className="underline underline-offset-2">
            expense
          </Link>{" "}
          {isPersonal && (
            <>
              or some{" "}
              <Link href="/income" className="underline underline-offset-2">
                income
              </Link>{" "}
              or{" "}
              <Link href="/savings" className="underline underline-offset-2">
                savings
              </Link>{" "}
            </>
          )}
          and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <ul className="divide-border mt-2 divide-y">
      {entries.map((entry) => {
        const isConverted = entry.currency !== baseCurrency;
        const style = amountStyle(entry.kind, entry.baseAmount);
        const fallbackIcon =
          entry.kind === "savings" ? (LIQUIDITY_ICON[entry.liquidity ?? "liquid"] ?? "•") : "•";

        return (
          <li
            key={`${entry.kind}-${entry.id}`}
            className="flex items-start justify-between gap-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-3">
              <span
                aria-hidden
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-base"
                style={{ backgroundColor: `${entry.categoryColor ?? "#94a3b8"}33` }}
              >
                {entry.categoryIcon ?? fallbackIcon}
              </span>

              <div className="min-w-0">
                <p className="text-foreground text-sm font-medium">
                  <span className="truncate align-middle">
                    {entry.description || entry.categoryName || "Untitled"}
                  </span>
                  {entry.organizationId !== activeSpaceId && <SpaceBadge name={entry.spaceName} />}
                </p>
                <p className="text-muted-foreground mt-0.5 truncate text-xs">
                  {dateFormatter.format(entry.date)}
                  {entry.categoryName && ` · ${entry.categoryName}`}
                  {showAuthor && entry.createdByName && ` · ${entry.createdByName}`}
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p className={cn("text-sm font-semibold tabular-nums", style.className)}>
                {style.sign}
                {formatMoney(Math.abs(Number(entry.baseAmount)).toFixed(2), baseCurrency)}
              </p>

              {isConverted && (
                <p className="text-muted-foreground text-xs tabular-nums">
                  {formatMoney(Math.abs(Number(entry.amount)).toFixed(2), entry.currency)}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default RecentEntries;
