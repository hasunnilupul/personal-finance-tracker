"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BellIcon, CheckIcon, CopyIcon, MailIcon, TriangleAlertIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelInvitationAction,
  inviteMemberAction,
  InviteNotice as InviteNoticeState,
  InviteState,
  leaveSpaceAction,
  notifyInvitationAction,
  removeMemberAction,
  sendInvitationEmailAction,
} from "@/app/actions/member.actions";
import { Invitation, SpaceMember } from "@/lib/db/models/organization.model";
import { cn } from "@/lib/utils";

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

/**
 * What became of the in-app notice, shown only when the address had an account.
 *
 * Somebody with an account is notified without being asked about: the notice
 * reaches the bell and the phone, and arrives whatever `RESEND_FROM` is set to.
 * Email is offered afterwards as an extra rather than as a choice.
 *
 * A `failed` outcome is the case this panel exists for. The invitation is real
 * and the link works, but nobody has been told about it — so it alerts, and
 * leads with the two things that still can tell them.
 */
const InviteNotice = ({
  invitationId,
  notice,
  emailConfigured,
}: {
  invitationId: string;
  notice: InviteNoticeState;
  emailConfigured: boolean;
}) => {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(notice.outcome === "failed");
  const [emailed, setEmailed] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const send = (channel: "email" | "app") => {
    startTransition(async () => {
      const response =
        channel === "email"
          ? await sendInvitationEmailAction(invitationId)
          : await notifyInvitationAction(invitationId);

      if (response.error) {
        toast.error(response.error);
        return;
      }

      if (channel === "email") {
        setEmailed(true);
      } else {
        setFailed(false);
      }

      setResult(response.success ?? "Sent");
      toast.success(response.success ?? "Sent");
    });
  };

  const heading = failed
    ? `Could not notify ${notice.name} in the app`
    : `${notice.name} has been notified in the app`;

  const detail = failed
    ? "The invitation is valid, but nothing has reached them. Try again, email them, or send the link below."
    : notice.outcome === "duplicate"
      ? "They had already been notified about this invitation."
      : "It is in their notifications now, and on their phone if they have push turned on.";

  return (
    <div
      // Only the failure is announced. A notice that worked is a confirmation,
      // and interrupting a screen reader with one is noise.
      role={failed ? "alert" : undefined}
      className={cn(
        "mt-4 rounded-xl border p-4",
        failed ? "border-destructive/40 bg-destructive/5" : "border-border bg-muted/40",
      )}
    >
      <p
        className={cn(
          "flex items-center gap-1.5 text-sm font-medium",
          failed ? "text-destructive" : "text-foreground",
        )}
      >
        {failed ? <TriangleAlertIcon className="size-4 shrink-0" /> : null}
        {heading}
      </p>

      <p className="text-muted-foreground mt-1 text-xs">{result ?? detail}</p>

      {(failed || !emailed) && (
        <div className="mt-3 flex flex-wrap gap-2">
          {failed && (
            <Button size="sm" onClick={() => send("app")} disabled={isPending}>
              <BellIcon />
              Try again
            </Button>
          )}

          {!emailed && (
            <Button
              size="sm"
              // Outline even in the failure case: the retry beside it is the
              // action being recommended, and two primaries recommend neither.
              variant="outline"
              onClick={() => send("email")}
              disabled={isPending || !emailConfigured}
              title={emailConfigured ? undefined : "Email is not configured"}
            >
              <MailIcon />
              {failed ? "Send an email" : "Send an email too"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * The link, shown for every invitation — it is the one channel that always
 * works, whatever happened to the email and the notice above it.
 *
 * `delivered` says whether anything else actually reached them, because the
 * line under the heading is otherwise a guess: an existing account is not
 * emailed, so `emailSent` alone would have this claiming email is unconfigured
 * on a screen where it plainly is.
 */
const InviteLink = ({
  url,
  emailSent,
  noticeSent,
}: {
  url: string;
  emailSent?: boolean;
  noticeSent?: boolean;
}) => {
  const delivered = emailSent || noticeSent;
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
        {delivered ? "Invitation sent" : "Invitation created"}
      </p>

      <p className="text-muted-foreground mt-1 text-xs">
        {emailSent
          ? "An email is on its way. You can also send this link directly."
          : noticeSent
            ? "They have it in the app. You can also send this link directly."
            : "Send this link to them yourself."}
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
              ? "Someone who already has an account is notified in the app. Anyone else gets an email with a link to join."
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

          {inviteState.invitationId && inviteState.notice && (
            <InviteNotice
              // Remounts per invitation, so the local "already emailed" and
              // "retried" state cannot carry over to the next person invited.
              key={inviteState.invitationId}
              invitationId={inviteState.invitationId}
              notice={inviteState.notice}
              emailConfigured={emailConfigured}
            />
          )}

          {inviteState.inviteUrl && (
            <InviteLink
              url={inviteState.inviteUrl}
              emailSent={inviteState.emailSent}
              noticeSent={Boolean(inviteState.notice) && inviteState.notice?.outcome !== "failed"}
            />
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
