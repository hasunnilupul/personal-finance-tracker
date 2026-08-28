import BaseCurrencyForm from "@/components/base-currency-form";
import ExportCard from "@/components/export-card";
import PushToggle from "@/components/push-toggle";
import { Card } from "@/components/ui/card";
import { requireActiveSpace } from "@/lib/auth/dal";
import { roleHasPermission } from "@/lib/auth/permissions";
import { isPushConfigured } from "@/lib/services/push.service";
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

      {/*
        Every role that can read the ledger can export it. There is no separate
        permission because there is nothing here a member cannot already see one
        page at a time — an export changes the convenience, not the access.
      */}
      <ExportCard
        spaceName={space.name}
        baseCurrency={space.baseCurrency}
        isPersonal={space.isPersonal}
      />

      {/*
        Push belongs to the device rather than to the space, but this is the
        settings screen people find. The toggle reads its own browser state.
      */}
      <PushToggle
        configured={isPushConfigured()}
        publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
      />
    </div>
  );
};

export default SpaceSettingsPage;
