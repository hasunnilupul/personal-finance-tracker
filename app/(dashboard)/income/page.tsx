import Link from "next/link";

import TransactionPageContent, {
  TransactionSearchParams,
} from "@/components/transactions/transaction-page";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveSpace } from "@/lib/auth/dal";

interface IncomePageProps {
  searchParams: Promise<TransactionSearchParams>;
}

/**
 * Income, which exists only in a personal space.
 *
 * A shared space is a joint record of what a household spends; what each member
 * earns is their own, and is recorded once — in their personal space — rather
 * than copied into every space they happen to belong to. Expenses go the other
 * way: one added to a shared space is counted against the personal ledger of
 * whoever added it, because that is whose money it was.
 *
 * **A shared space explains rather than redirects, and that is deliberate
 * twice over.** `redirect()` in a streaming context does not serve a 307 — it
 * emits a meta tag for the client to act on, and this route streams, because
 * the dashboard layout flushes its shell before the page resolves. So the
 * bounce is a client-side one that sometimes arrives late enough to be seen;
 * the browser suite caught exactly that. And even working perfectly it is the
 * worse answer: somebody who followed a bookmark here deserves to be told where
 * their income went, not moved somewhere else without a word.
 *
 * The tab is hidden in a shared space, so this is for the URL typed by hand,
 * the stale bookmark, and the back button.
 */
const IncomePage = async ({ searchParams }: IncomePageProps) => {
  const { space } = await requireActiveSpace();

  if (!space.isPersonal) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-foreground text-xl font-semibold tracking-tight">Income</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Not recorded in {space.name}, which is a shared space.
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-foreground text-base font-semibold">
            Income lives in your personal space
          </h2>

          <p className="text-muted-foreground mt-1 text-sm">
            A shared space records what the household spends. What you earn is yours, so it is kept
            once in your own ledger rather than copied into every space you belong to — switch
            spaces with the picker at the top of the page to reach it.
          </p>

          <p className="text-muted-foreground mt-3 text-sm">
            Anything you add to {space.name} still counts against your personal space, because it is
            your money that paid for it.
          </p>

          <Link
            href="/expenses"
            className={buttonVariants({ variant: "default", className: "mt-4" })}
          >
            See this space&apos;s expenses
          </Link>
        </Card>
      </div>
    );
  }

  return <TransactionPageContent kind="income" searchParams={searchParams} />;
};

export default IncomePage;
