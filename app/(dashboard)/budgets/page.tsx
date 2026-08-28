import { Suspense } from "react";

import BudgetPeriodNav from "@/components/budgets/budget-period-nav";
import BudgetSections from "@/components/budgets/budget-sections";
import BudgetSectionsSkeleton from "@/components/budgets/budget-sections-skeleton";
import { requireActiveSpace } from "@/lib/auth/dal";
import { monthWindow, resolveMonthKey } from "@/lib/budgets/period";

interface BudgetsPageProps {
  searchParams: Promise<{ month?: string }>;
}

/**
 * Budgets for a calendar month, and for the year around it.
 *
 * The month comes from the URL so a past month can be bookmarked and the page
 * stays a Server Component. Junk in `?month=` is ignored and the current month
 * shown instead, rather than trusted into a date query.
 *
 * Periods are calendar-aligned, which is what makes rollover free: nothing is
 * materialised per month, so on the first of the month both sections move on
 * their own.
 *
 * The month arrows are outside the `<Suspense>` boundary and the cards are
 * inside it, keyed on the month: stepping through months leaves the control
 * that does the stepping in place and greys only the figures. The window label
 * beside the arrows comes from `monthWindow`, the same pure function the
 * service uses, so it needs no query and cannot disagree with the cards.
 */
const BudgetsPage = async ({ searchParams }: BudgetsPageProps) => {
  const params = await searchParams;
  const { space } = await requireActiveSpace();

  const month = resolveMonthKey(params.month);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Budgets</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Spending limits per category, in {space.baseCurrency}.
          {space.isPersonal
            ? " Measured against this space's own entries — a shared space's budgets are set there."
            : ` Shared with everyone in ${space.name}.`}
        </p>
      </div>

      <BudgetPeriodNav month={month} label={monthWindow(month).label} />

      <Suspense key={month} fallback={<BudgetSectionsSkeleton />}>
        <BudgetSections month={month} />
      </Suspense>
    </div>
  );
};

export default BudgetsPage;
