import BaseCurrencyForm from "@/components/base-currency-form";
import { Card } from "@/components/ui/card";
import { requireActiveSpace } from "@/lib/auth/dal";
import { roleHasPermission } from "@/lib/auth/permissions";
import { getCurrency } from "@/constants/currencies";

const SpaceSettingsPage = async () => {
  const { space, role } = await requireActiveSpace();

  const canEdit = roleHasPermission(role, { organization: ["update"] });
  const currency = getCurrency(space.baseCurrency);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Space settings</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Settings for <span className="text-foreground font-medium">{space.name}</span>.
        </p>
      </div>

      {canEdit ? (
        <BaseCurrencyForm currentCurrency={space.baseCurrency} />
      ) : (
        <Card className="p-6">
          <h2 className="text-foreground text-base font-semibold">Base currency</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            This space reports in{" "}
            <span className="text-foreground">
              {currency ? `${currency.name} (${currency.code})` : space.baseCurrency}
            </span>
            . Only the space owner can change it.
          </p>
        </Card>
      )}
    </div>
  );
};

export default SpaceSettingsPage;
