import RecurringManager from "@/components/recurring/recurring-manager";
import { requireActiveSpace } from "@/lib/auth/dal";
import { categoryService } from "@/lib/services/category.service";
import { recurringTransactionService } from "@/lib/services/recurring-transaction.service";

/**
 * Recurring entries: templates that turn into real expenses and income when
 * they come due.
 *
 * **This page catches up before it reads.** Materialising on a page load is the
 * guarantee that occurrences actually happen — `CRON_SECRET` is optional and
 * unset here, so a cron-only trigger would never fire. The catch-up is idempotent
 * and guarded by a count, so the usual case costs one indexed query.
 *
 * It is a write from a Server Component, which is not something to do lightly.
 * It is safe here because the occurrence key makes it repeatable: a re-render, a
 * prefetch and a double submit all converge on the same rows.
 */
const RecurringPage = async () => {
  const { ctx, space } = await requireActiveSpace();

  await recurringTransactionService.catchUp(ctx);

  const [templates, expenseCategories, incomeCategories] = await Promise.all([
    recurringTransactionService.getAll(ctx),
    categoryService.getCategoriesByType(ctx, "expense"),
    // A shared space holds none, and the form does not offer the kind there.
    space.isPersonal ? categoryService.getCategoriesByType(ctx, "income") : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Recurring</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Entries that repeat on a schedule. They are created automatically when they come due.
          {space.isPersonal ? "" : ` Shared with everyone in ${space.name}.`}
        </p>
      </div>

      <RecurringManager
        templates={templates}
        expenseCategories={expenseCategories}
        incomeCategories={incomeCategories}
        allowIncome={space.isPersonal}
        baseCurrency={space.baseCurrency}
      />
    </div>
  );
};

export default RecurringPage;
