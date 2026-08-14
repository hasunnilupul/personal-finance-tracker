"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { PlusIcon, UsersIcon, WalletIcon } from "lucide-react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { switchSpaceAction } from "@/app/actions/space.actions";
import { Space } from "@/lib/db/models/organization.model";

const CREATE_SPACE_VALUE = "__create__";

interface SpaceSwitcherProps {
  spaces: Space[];
  activeSpaceId: string;
}

/**
 * Switches the ledger the dashboard is showing.
 *
 * The personal space always sorts first. Choosing "New shared space" routes to
 * the creation form rather than switching.
 */
const SpaceSwitcher = ({ spaces, activeSpaceId }: SpaceSwitcherProps) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: unknown) => {
    const nextId = String(value);

    if (nextId === CREATE_SPACE_VALUE) {
      router.push("/spaces/new");
      return;
    }

    if (nextId === activeSpaceId) {
      return;
    }

    startTransition(async () => {
      const result = await switchSpaceAction(nextId);

      if (result.error) {
        toast.error(result.error);
        return;
      }

      router.refresh();
    });
  };

  return (
    <Select value={activeSpaceId} onValueChange={handleChange} disabled={isPending}>
      <SelectTrigger size="sm" className="w-full" aria-label="Active space">
        <SelectValue />
      </SelectTrigger>

      <SelectContent>
        {spaces.map((space) => (
          <SelectItem key={space.id} value={space.id}>
            {space.isPersonal ? (
              <WalletIcon className="text-muted-foreground" />
            ) : (
              <UsersIcon className="text-muted-foreground" />
            )}
            {space.name}
          </SelectItem>
        ))}

        <SelectItem value={CREATE_SPACE_VALUE}>
          <PlusIcon className="text-muted-foreground" />
          New shared space
        </SelectItem>
      </SelectContent>
    </Select>
  );
};

export default SpaceSwitcher;
