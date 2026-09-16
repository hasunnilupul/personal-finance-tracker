import Link from "next/link";

import TransactionPageContent, {
  TransactionSearchParams,
} from "@/components/transactions/transaction-page";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { requireActiveSpace } from "@/lib/auth/dal";

interface SavingsPageProps {
  searchParams: Promise<TransactionSearchParams>;
}

/**
 * Savings, which exists only in a personal space.
 *
 * A shared space is a joint record of what a household spends; what each
 * member sets aside is their own, exactly like income — see `IncomePage`. A
 * saving is real money, deducted from the personal balance the same way an
 * expense is, tagged `liquid` or `locked` for reporting only.
 *
 * A shared space explains rather than redirects, for the same two reasons
 * `IncomePage` does: `redirect()` in a streaming route is not a reliable
 * 307, and someone who followed a bookmark here deserves to be told where
 * their savings went rather than moved without a word.
 *
 * The tab is hidden in a shared space, so this is for the URL typed by hand,
 * the stale bookmark, and the back button.
 */
const SavingsPage = async ({ searchParams }: SavingsPageProps) => {
  const { space } = await requireActiveSpace();

  if (!space.isPersonal) {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-foreground text-xl font-semibold tracking-tight">Savings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Not recorded in {space.name}, which is a shared space.
          </p>
        </div>

        <Card className="p-6">
          <h2 className="text-foreground text-base font-semibold">
            Savings live in your personal space
          </h2>

          <p className="text-muted-foreground mt-1 text-sm">
            A shared space records what the household spends. What you set aside is yours, so it is
            kept once in your own ledger rather than copied into every space you belong to — switch
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

  return <TransactionPageContent kind="savings" searchParams={searchParams} />;
};

export default SavingsPage;
