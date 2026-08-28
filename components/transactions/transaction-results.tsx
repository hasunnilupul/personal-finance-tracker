import TransactionManager from "@/components/transactions/transaction-manager";
import { requireActiveSpace } from "@/lib/auth/dal";
import { transactionService } from "@/lib/services/transaction.service";
import { Category } from "@/lib/db/models/category.model";
import { TransactionFilters, TransactionKind } from "@/lib/db/models/transaction.model";

interface TransactionResultsProps {
  kind: TransactionKind;
  filters: TransactionFilters;
  /** Fetched by the page for the filter bar, and passed on so the form dialog
   *  does not ask for the same list a second time. */
  categories: Category[];
  basePath: string;
  query: string;
  hasFilters: boolean;
}

/**
 * The filtered list and its total — everything on the page that a filter
 * actually changes.
 *
 * Split out of the page so it can sit behind its own `<Suspense>`: the header
 * and the filter bar are rendered from what the URL already says and stay put,
 * while the two queries that depend on the filters stream in behind a skeleton.
 *
 * `requireActiveSpace` is called again here rather than passed down. It is
 * memoized with React `cache` for the render pass, so this costs nothing, and
 * it keeps the rule that every server component resolves the space it is
 * scoped to rather than trusting a prop it was handed.
 */
const TransactionResults = async ({
  kind,
  filters,
  categories,
  basePath,
  query,
  hasFilters,
}: TransactionResultsProps) => {
  const { ctx, space } = await requireActiveSpace();

  const [page, total] = await Promise.all([
    transactionService.list(ctx, kind, filters),
    transactionService.total(ctx, kind, filters),
  ]);

  return (
    <TransactionManager
      kind={kind}
      page={page}
      total={total}
      categories={categories}
      baseCurrency={space.baseCurrency}
      showAuthor={!space.isPersonal}
      activeSpaceId={space.id}
      basePath={basePath}
      query={query}
      hasFilters={hasFilters}
    />
  );
};

export default TransactionResults;
