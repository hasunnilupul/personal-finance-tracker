import BudgetSection from "@/components/budgets/budget-section";
import { requireActiveSpace } from "@/lib/auth/dal";
import { budgetService } from "@/lib/services/budget.service";
import { categoryService } from "@/lib/services/category.service";
import { currentMonthKey, MonthKey } from "@/lib/budgets/period";

interface BudgetSectionsProps {
  /** The month on screen, `YYYY-MM`, already resolved from the URL. */
  month: MonthKey;
}

/**
 * The monthly and yearly cards for one window.
 *
 * Everything on the budgets page that changes when the month arrows are used,
 * split out so it can stream behind a skeleton while the header and the arrows
 * themselves stay on screen.
 */
const BudgetSections = async ({ month }: BudgetSectionsProps) => {
  const { ctx, space } = await requireActiveSpace();

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
    <>
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
    </>
  );
};

export default BudgetSections;
