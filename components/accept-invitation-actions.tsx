"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import {
  acceptInvitationAction,
  InvitationResponseState,
  rejectInvitationAction,
} from "@/app/actions/invitation.actions";

const initialState: InvitationResponseState = {};

interface AcceptInvitationActionsProps {
  invitationId: string;
  spaceName: string;
}

/**
 * Accept and decline buttons for a valid invitation.
 *
 * Two separate forms so each posts to its own action and keeps working
 * without JavaScript.
 */
const AcceptInvitationActions = ({ invitationId, spaceName }: AcceptInvitationActionsProps) => {
  const [acceptState, accept, accepting] = useActionState(acceptInvitationAction, initialState);
  const [rejectState, reject, rejecting] = useActionState(rejectInvitationAction, initialState);

  const error = acceptState.error ?? rejectState.error;
  const busy = accepting || rejecting;

  return (
    <>
      {error && (
        <p className="text-destructive mt-4 text-sm" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-col gap-2">
        <form action={accept}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <Button type="submit" className="w-full" disabled={busy}>
            {accepting ? "Joining..." : `Join ${spaceName}`}
          </Button>
        </form>

        <form action={reject}>
          <input type="hidden" name="invitationId" value={invitationId} />
          <Button type="submit" variant="ghost" className="w-full" disabled={busy}>
            {rejecting ? "Declining..." : "Decline"}
          </Button>
        </form>
      </div>
    </>
  );
};

export default AcceptInvitationActions;
