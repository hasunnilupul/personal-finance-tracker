import TransactionFilters from "@/components/transactions/transaction-filters";
import TransactionManager from "@/components/transactions/transaction-manager";
import { requireActiveSpace } from "@/lib/auth/dal";
import { categoryService } from "@/lib/services/category.service";
import { transactionService } from "@/lib/services/transaction.service";
import { DEFAULT_PAGE_SIZE, TransactionKind } from "@/lib/db/models/transaction.model";

export interface TransactionSearchParams {
  from?: string;
  to?: string;
  categoryId?: string;
  createdBy?: string;
  page?: string;
}

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
 */
const TransactionPageContent = async ({ kind, searchParams }: TransactionPageProps) => {
  const params = await searchParams;
  const { ctx, space } = await requireActiveSpace();

  const filters = {
    from: toDateFilter(params.from),
    to: toDateFilter(params.to),
    categoryId: toPositiveInt(params.categoryId),
    createdBy: params.createdBy || undefined,
    page: toPositiveInt(params.page) ?? 1,
    pageSize: DEFAULT_PAGE_SIZE,
  };

  const basePath = kind === "expense" ? "/expenses" : "/income";

  const [page, total, categories, authors] = await Promise.all([
    transactionService.list(ctx, kind, filters),
    transactionService.total(ctx, kind, filters),
    categoryService.getCategoriesByType(ctx, kind === "expense" ? "expense" : "income"),
    transactionService.listAuthors(ctx, kind),
  ]);

  const hasFilters = Boolean(filters.from || filters.to || filters.categoryId || filters.createdBy);

  const query = new URLSearchParams(
    Object.entries(params).filter(([, value]) => Boolean(value)) as [string, string][],
  ).toString();

  return (
    <div className="flex flex-col gap-4">
      <TransactionFilters
        basePath={basePath}
        categories={categories}
        authors={authors}
        showAuthorFilter={!space.isPersonal}
        current={{
          from: filters.from,
          to: filters.to,
          categoryId: params.categoryId,
          createdBy: filters.createdBy,
        }}
      />

      <TransactionManager
        kind={kind}
        page={page}
        total={total}
        categories={categories}
        baseCurrency={space.baseCurrency}
        showAuthor={!space.isPersonal}
        basePath={basePath}
        query={query}
        hasFilters={hasFilters}
      />
    </div>
  );
};

export default TransactionPageContent;
