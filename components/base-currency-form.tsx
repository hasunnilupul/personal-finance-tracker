"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SpaceSettingsState, updateBaseCurrencyAction } from "@/app/actions/space-settings.actions";
import { SUPPORTED_CURRENCIES } from "@/constants/currencies";

const initialState: SpaceSettingsState = {};

interface BaseCurrencyFormProps {
  currentCurrency: string;
}

/**
 * Changes the currency a space reports in.
 *
 * The selected value is mirrored into a hidden input because the Select is a
 * controlled Base UI component rather than a native form control.
 */
const BaseCurrencyForm = ({ currentCurrency }: BaseCurrencyFormProps) => {
  const [state, formAction, pending] = useActionState(updateBaseCurrencyAction, initialState);
  const [selected, setSelected] = useState(currentCurrency);

  // `items` is what makes the trigger show a currency's full label rather than
  // the bare code it is backed by — see Gotchas.
  const currencyItems = SUPPORTED_CURRENCIES.map((currency) => ({
    value: currency.code,
    label: `${currency.code} — ${currency.name}`,
  }));

  return (
    <Card className="p-6">
      <h2 className="text-foreground text-base font-semibold">Base currency</h2>

      <p className="text-muted-foreground mt-1 text-sm">
        Every total and budget in this space is reported in this currency. You can still record an
        entry in any other currency — it gets converted at the rate for that entry&rsquo;s date.
      </p>

      <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <input type="hidden" name="baseCurrency" value={selected} />

        <div className="flex flex-1 flex-col gap-2">
          <Label htmlFor="currency-trigger">Currency</Label>

          <Select
            items={currencyItems}
            value={selected}
            onValueChange={(value) => setSelected(String(value))}
          >
            <SelectTrigger id="currency-trigger" className="w-full">
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {currencyItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={pending || selected === currentCurrency}>
          {pending ? "Converting..." : "Save"}
        </Button>
      </form>

      {selected !== currentCurrency && (
        <p className="text-muted-foreground mt-3 text-xs">
          Existing entries keep what was actually spent. Their converted totals are recalculated
          using the rate from each entry&rsquo;s own date, not today&rsquo;s.
        </p>
      )}

      {state.error && (
        <p className="text-destructive mt-3 text-sm" role="alert">
          {state.error}
        </p>
      )}

      {state.success && <p className="mt-3 text-sm text-emerald-600">{state.success}</p>}
    </Card>
  );
};

export default BaseCurrencyForm;
