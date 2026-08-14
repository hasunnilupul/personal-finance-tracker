"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckIcon, CopyIcon, MailIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelInvitationAction,
  inviteMemberAction,
  InviteState,
  leaveSpaceAction,
  removeMemberAction,
} from "@/app/actions/member.actions";
import { Invitation, SpaceMember } from "@/lib/db/models/organization.model";

const initialInviteState: InviteState = {};

interface MembersManagerProps {
  spaceName: string;
  members: SpaceMember[];
  invitations: Invitation[];
  currentUserId: string;
  canInvite: boolean;
  emailConfigured: boolean;
}

/**
 * Copies text, falling back to a prompt when the clipboard API is unavailable
 * (it needs a secure context, which a LAN dev URL is not).
 */
async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

const InviteLink = ({ url, emailSent }: { url: string; emailSent?: boolean }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(url);

    if (!ok) {
      toast.error("Could not copy. Select the link and copy it manually.");
      return;
    }

    setCopied(true);
    toast.success("Invite link copied");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border-border bg-muted/40 mt-4 rounded-xl border p-4">
      <p className="text-foreground text-sm font-medium">
        {emailSent ? "Invitation sent" : "Invitation created"}
      </p>

      <p className="text-muted-foreground mt-1 text-xs">
        {emailSent
          ? "An email is on its way. You can also send this link directly."
          : "Email is not configured, so send this link to them yourself."}
      </p>

      <div className="mt-3 flex items-center gap-2">
        <Input
          readOnly
          value={url}
          className="font-mono text-xs"
          onFocus={(e) => e.target.select()}
        />

        <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
    </div>
  );
};

/**
 * Manages who is in a shared space.
 *
 * Owners get the invite form and the remove/withdraw controls; members get a
 * read-only list and the option to leave. The buttons are hidden for members
 * as a courtesy — the server actions are what actually enforce this.
 */
const MembersManager = ({
  spaceName,
  members,
  invitations,
  currentUserId,
  canInvite,
  emailConfigured,
}: MembersManagerProps) => {
  const router = useRouter();
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteMemberAction,
    initialInviteState,
  );
  const [isPending, startTransition] = useTransition();

  const runAction = (action: () => Promise<{ error?: string; success?: string }>) => {
    startTransition(async () => {
      const result = await action();

      if (result.error) {
        toast.error(result.error);
        return;
      }

      if (result.success) {
        toast.success(result.success);
      }

      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">Members</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Everyone in <span className="text-foreground font-medium">{spaceName}</span> can add and
          edit entries. Only you can invite or remove people.
        </p>
      </div>

      {canInvite && (
        <Card className="p-6">
          <h2 className="text-foreground text-base font-semibold">Invite someone</h2>

          <p className="text-muted-foreground mt-1 text-sm">
            {emailConfigured
              ? "They will get an email with a link to join."
              : "Email is not set up yet, so you will get a link to send them."}
          </p>

          <form action={inviteAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="family@example.com"
                required
              />
            </div>

            <Button type="submit" disabled={invitePending}>
              <MailIcon />
              {invitePending ? "Inviting..." : "Send invite"}
            </Button>
          </form>

          {inviteState.error && (
            <p className="text-destructive mt-3 text-sm" role="alert">
              {inviteState.error}
            </p>
          )}

          {inviteState.inviteUrl && (
            <InviteLink url={inviteState.inviteUrl} emailSent={inviteState.emailSent} />
          )}
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-foreground text-base font-semibold">
          In this space ({members.length})
        </h2>

        <ul className="mt-4 flex flex-col divide-y">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <p className="text-foreground truncate text-sm font-medium">
                  {member.name}
                  {member.userId === currentUserId && (
                    <span className="text-muted-foreground font-normal"> (you)</span>
                  )}
                </p>
                <p className="text-muted-foreground truncate text-xs">{member.email}</p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <span className="text-muted-foreground text-xs capitalize">{member.role}</span>

                {canInvite && member.userId !== currentUserId && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => runAction(() => removeMemberAction(member.id))}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>

      {canInvite && invitations.length > 0 && (
        <Card className="p-6">
          <h2 className="text-foreground text-base font-semibold">
            Pending invitations ({invitations.length})
          </h2>

          <ul className="mt-4 flex flex-col divide-y">
            {invitations.map((invitation) => (
              <li key={invitation.id} className="flex items-center justify-between gap-4 py-3">
                <div className="min-w-0">
                  <p className="text-foreground truncate text-sm">{invitation.email}</p>
                  <p className="text-muted-foreground text-xs">
                    Expires {invitation.expiresAt.toLocaleDateString()}
                  </p>
                </div>

                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={() => runAction(() => cancelInvitationAction(invitation.id))}
                >
                  Withdraw
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!canInvite && (
        <Card className="p-6">
          <h2 className="text-foreground text-base font-semibold">Leave this space</h2>

          <p className="text-muted-foreground mt-1 text-sm">
            You will lose access to its entries. Anything you added stays with the space.
          </p>

          <Button
            type="button"
            variant="destructive"
            className="mt-4"
            disabled={isPending}
            onClick={() => runAction(leaveSpaceAction)}
          >
            Leave {spaceName}
          </Button>
        </Card>
      )}
    </div>
  );
};

export default MembersManager;
