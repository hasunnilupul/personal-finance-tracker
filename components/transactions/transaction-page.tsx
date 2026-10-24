import { Suspense } from "react";

import TransactionFilters from "@/components/transactions/transaction-filters";
import TransactionResults from "@/components/transactions/transaction-results";
import TransactionResultsSkeleton from "@/components/transactions/transaction-results-skeleton";
import { requireActiveSpace } from "@/lib/auth/dal";
import { currentMonthRange } from "@/lib/reports/range";
import { categoryService } from "@/lib/services/category.service";
import { transactionService } from "@/lib/services/transaction.service";
import { DEFAULT_PAGE_SIZE, TransactionKind } from "@/lib/db/models/transaction.model";

export interface TransactionSearchParams {
  from?: string;
  to?: string;
  categoryId?: string;
  createdBy?: string;
  search?: string;
  page?: string;
}

/** Long enough for any real note; short enough that a pasted wall of text is not a query. */
const MAX_SEARCH_LENGTH = 100;

interface TransactionPageProps {
  kind: TransactionKind;
  searchParams: Promise<TransactionSearchParams>;
}

/**
 * Turns a raw query-string value into a positive integer, or `undefined`.
 *
 * Filters come from the URL, so anything can arrive here. A junk value should
 * mean "no filter" rather than a crash or a NaN in a query.
 */
function toPositiveInt(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/**
 * Accepts only a `YYYY-MM-DD` date, ignoring anything else.
 */
function toDateFilter(value: string | undefined): string | undefined {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

/**
 * The shared page for expenses and income.
 *
 * Both routes render this with a different `kind`; everything else — filters,
 * totals, pagination, the add/edit dialog — is identical.
 *
 * **Expenses and income open on the current month.** A ledger that opens on
 * everything ever recorded is a page that gets slower and less readable every
 * month. The default is applied here rather than by redirecting, so the URL
 * stays clean, and it applies only while the URL names neither end of a range:
 * the moment either `from` or `to` is present — even empty, which is how the
 * filter bar says "no limit on this end" — the URL is believed as written.
 * Savings is a running pool rather than a monthly flow, so it opens on all of it.
 *
 * The filter bar and the results are split across a `<Suspense>` boundary. The
 * bar depends only on the space, so it renders as soon as the categories and
 * authors are known and then stays; the list and the total depend on the
 * filters, so they stream in behind a skeleton every time one changes.
 *
 * **The boundary is keyed on the filters.** Without a `key` React keeps the
 * resolved boundary mounted across a search-param navigation and shows the old
 * rows until the new ones arrive, which reads as a page that ignored the click.
 * `loading.tsx` does not cover this either — the segment never unmounts, so its
 * fallback belongs to the first visit only.
 */
const TransactionPageContent = async ({ kind, searchParams }: TransactionPageProps) => {
  const params = await searchParams;
  const { ctx, space } = await requireActiveSpace();

  const defaultRange: { from?: string; to?: string } =
    kind === "savings" ? {} : currentMonthRange();
  const hasExplicitRange = params.from !== undefined || params.to !== undefined;

  const filters = {
    from: hasExplicitRange ? toDateFilter(params.from) : defaultRange.from,
    to: hasExplicitRange ? toDateFilter(params.to) : defaultRange.to,
    categoryId: toPositiveInt(params.categoryId),
    createdBy: params.createdBy || undefined,
    search: params.search?.trim().slice(0, MAX_SEARCH_LENGTH) || undefined,
    page: toPositiveInt(params.page) ?? 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const basePath = kind === "expense" ? "/expenses" : kind === "income" ? "/income" : "/savings";

  // Savings is never categorised — there is no picker for it, so there is
  // nothing to fetch.
  const [categories, authors] = await Promise.all([
    kind === "savings"
      ? Promise.resolve([])
      : categoryService.getCategoriesByType(ctx, kind === "expense" ? "expense" : "income"),
    transactionService.listAuthors(ctx, kind),
  ]);

  const hasFilters = Boolean(
    filters.from || filters.to || filters.categoryId || filters.createdBy || filters.search,
  );

  // Pagination links are built from this. The range is written out in full,
  // empty ends included: left implicit, page 2 of "everything" would quietly
  // become page 2 of this month.
  const query = new URLSearchParams(
    Object.entries(params).filter(([key, value]) => key !== "from" && key !== "to" && value) as [
      string,
      string,
    ][],
  );

  query.set("from", filters.from ?? "");
  query.set("to", filters.to ?? "");

  return (
    <div className="flex flex-col gap-4">
      <TransactionFilters
        basePath={basePath}
        categories={categories}
        authors={authors}
        showAuthorFilter={!space.isPersonal}
        showCategoryFilter={kind !== "savings"}
        defaults={defaultRange}
        current={{
          from: filters.from,
          to: filters.to,
          categoryId: params.categoryId,
          createdBy: filters.createdBy,
          search: filters.search,
        }}
      />

      <Suspense
        key={`${filters.from ?? ""}|${filters.to ?? ""}|${filters.categoryId ?? ""}|${filters.createdBy ?? ""}|${filters.search ?? ""}|${filters.page}`}
        fallback={<TransactionResultsSkeleton kind={kind} />}
      >
        <TransactionResults
          kind={kind}
          filters={filters}
          categories={categories}
          basePath={basePath}
          query={query.toString()}
          hasFilters={hasFilters}
        />
      </Suspense>
    </div>
  );
};

export default TransactionPageContent;
