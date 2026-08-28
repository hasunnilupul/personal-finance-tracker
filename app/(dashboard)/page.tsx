import Link from "next/link";

import BudgetHealth from "@/components/dashboard/budget-health";
import RecentEntries from "@/components/dashboard/recent-entries";
import StatTile from "@/components/charts/stat-tile";
import { Card } from "@/components/ui/card";
import { requireActiveSpace } from "@/lib/auth/dal";
import { dashboardService } from "@/lib/services/dashboard.service";
import { formatMoney } from "@/lib/currency/format";

/**
 * The dashboard: this month at a glance.
 *
 * Fixed to the current month with no range control of its own — the question it
 * answers is "where am I right now", and a dashboard that can be scrolled into
 * the past is the reports page with fewer features. Reports is where a range
 * belongs.
 *
 * Composed from the same services the other pages use, so the month's spend
 * here and the budget bars on `/budgets` are the same figure rather than two
 * that have to be kept in step.
 */
const DashboardPage = async () => {
  const { ctx, space } = await requireActiveSpace();
  const data = await dashboardService.getDashboard(ctx);

  const currency = space.baseCurrency;
  const isNegative = Number(data.totals.net) < 0;

  // A shared space has no income of its own to weigh spending against, so it
  // shows what it is: what the household spent. Printing an income of zero and
  // a net that is the expense total negated would be three tiles making one
  // claim, and the claim would be wrong — the money did come from somewhere.
  const showEarnings = space.isPersonal;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">{data.monthLabel}</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {space.isPersonal ? "Your personal space" : space.name}, in {currency}.
          {space.isPersonal && " Includes what you have spent from shared spaces."}
        </p>
      </div>

      <div className={showEarnings ? "grid gap-3 sm:grid-cols-3" : "grid gap-3"}>
        {showEarnings && (
          <StatTile
            label="Income this month"
            value={formatMoney(data.totals.income, currency)}
            accent="var(--viz-income)"
          />
        )}

        <StatTile
          label="Spent this month"
          value={formatMoney(data.totals.expense, currency)}
          accent="var(--viz-expense)"
          hint={showEarnings ? "Yours, across every space" : undefined}
        />

        {showEarnings && (
          <StatTile
            label="Net"
            value={formatMoney(data.totals.net, currency)}
            tone={isNegative ? "negative" : "positive"}
            hint={isNegative ? "Spent more than was earned" : "Kept out of income"}
          />
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">
              Recent activity
            </h2>
            <Link
              href="/expenses"
              className="text-muted-foreground hover:text-foreground text-xs underline underline-offset-2"
            >
              All expenses
            </Link>
          </div>

          <RecentEntries
            entries={data.recent}
            baseCurrency={currency}
            showAuthor={!space.isPersonal}
            activeSpaceId={space.id}
            isPersonal={space.isPersonal}
          />
        </Card>

        <Card className="p-4 sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-foreground text-lg font-semibold tracking-tight">Budget health</h2>

            {data.overCount > 0 && (
              <p className="text-destructive text-xs font-medium">{data.overCount} over budget</p>
            )}
          </div>

          <p className="text-muted-foreground mt-0.5 text-xs">
            Monthly budgets, the ones closest to their limit first
          </p>

          <BudgetHealth budgets={data.budgets} total={data.budgetCount} baseCurrency={currency} />
        </Card>
      </div>
    </div>
  );
};

export default DashboardPage;
