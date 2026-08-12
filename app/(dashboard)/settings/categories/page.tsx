import CategorySection from "@/components/categories/category-section";
import { requireActiveSpace } from "@/lib/auth/dal";
import { categoryService } from "@/lib/services/category.service";

/**
 * Manage the space's categories.
 *
 * Both types are fetched in one pass, with their usage counts, so the page
 * knows what deleting any given category would cost without a round-trip per
 * row.
 */
const CategoriesPage = async () => {
  const { ctx, space } = await requireActiveSpace();

  const categories = await categoryService.listWithUsage(ctx);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-foreground text-xl font-semibold tracking-tight">Categories</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          {space.isPersonal
            ? "Yours alone — these do not appear in any shared space."
            : `Shared with everyone in ${space.name}.`}
        </p>
      </div>

      <CategorySection
        type="expense"
        categories={categories.filter((category) => category.type === "expense")}
      />

      <CategorySection
        type="income"
        categories={categories.filter((category) => category.type === "income")}
      />
    </div>
  );
};

export default CategoriesPage;
