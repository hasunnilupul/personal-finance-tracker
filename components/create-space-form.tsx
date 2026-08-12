"use client";

import Link from "next/link";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createSpaceAction, SpaceActionState } from "@/app/actions/space.actions";

const initialState: SpaceActionState = {};

/**
 * Creates a shared space for joint expenses.
 *
 * The creator becomes its owner and is the only person who can invite others
 * into it.
 */
const CreateSpaceForm = () => {
  const [state, formAction, pending] = useActionState(createSpaceAction, initialState);

  return (
    <Card className="p-6">
      <div className="mb-6">
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Create a shared space
        </h1>

        <p className="text-muted-foreground mt-1 text-sm">
          A shared space has its own categories, budgets and entries. Everyone you invite can add
          and edit them, and your personal ledger stays private.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Space name</Label>

          <Input
            id="name"
            name="name"
            placeholder="Household"
            minLength={2}
            maxLength={50}
            required
            autoFocus
          />
        </div>

        {state.error && (
          <p className="text-destructive text-sm" role="alert">
            {state.error}
          </p>
        )}

        <div className="flex items-center gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? "Creating..." : "Create space"}
          </Button>

          <Button type="button" variant="ghost" disabled={pending} render={<Link href="/" />}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default CreateSpaceForm;
