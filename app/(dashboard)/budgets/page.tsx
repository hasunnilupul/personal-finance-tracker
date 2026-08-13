import BudgetPeriodNav from "@/components/budgets/budget-period-nav";
import BudgetSection from "@/components/budgets/budget-section";
import { requireActiveSpace } from "@/lib/auth/dal";
import { budgetService } from "@/lib/services/budget.service";
import { categoryService } from "@/lib/services/category.service";
import { currentMonthKey, resolveMonthKey } from "@/lib/budgets/period";

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
 */
const BudgetsPage = async ({ searchParams }: BudgetsPageProps) => {
  const params = await searchParams;
  const { ctx, space } = await requireActiveSpace();

  const month = resolveMonthKey(params.month);

  const [overview, categories] = await Promise.all([
    budgetService.getOverview(ctx, month),
    categoryService.getCategoriesByType(ctx, "expense"),
  ]);

  // A budget takes effect from the period it is created in, so adding one while
  // looking at a past window would produce a limit that does not appear on the
  // screen that created it. Each section is addable while its own period is the
  // live one — the yearly one all through the current year, even when an earlier
  // month of it is on screen.
  const current = currentMonthKey();
  const isCurrentMonth = month === current;
  const isCurrentYear = month.slice(0, 4) === current.slice(0, 4);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Budgets</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Spending limits per category, in {space.baseCurrency}.
          {space.isPersonal ? "" : ` Shared with everyone in ${space.name}.`}
        </p>
      </div>

      <BudgetPeriodNav month={month} label={overview.monthly.window.label} />

      <BudgetSection
        period="monthly"
        windowLabel={overview.monthly.window.label}
        budgets={overview.monthly.budgets}
        summary={overview.monthly.summary}
        categories={categories}
        takenByPeriod={overview.takenByPeriod}
        baseCurrency={space.baseCurrency}
        canAdd={isCurrentMonth}
      />

      <BudgetSection
        period="yearly"
        windowLabel={overview.yearly.window.label}
        budgets={overview.yearly.budgets}
        summary={overview.yearly.summary}
        categories={categories}
        takenByPeriod={overview.takenByPeriod}
        baseCurrency={space.baseCurrency}
        canAdd={isCurrentYear}
      />
    </div>
  );
};

export default BudgetsPage;
