"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { requireActiveSpace, requirePermission } from "@/lib/auth/dal";
import { buildInvitationUrl } from "@/lib/auth/urls";
import { isEmailConfigured } from "@/lib/email/client";
import { sendInvitationEmail } from "@/lib/email/invitation-email";
import { invitationRepository } from "@/lib/repositories/invitation.repository";
import { userRepository } from "@/lib/repositories/user.repository";
import { notificationService } from "@/lib/services/notification.service";
import { spaceService } from "@/lib/services/space.service";
import { isServiceError } from "@/lib/services/errors";
import { logger } from "@/lib/logger";

const MEMBERS_PATH = "/settings/members";

const inviteSchema = z.object({
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

export interface InviteState {
  error?: string;
  /** Present on success — always shown so the owner can send it themselves. */
  inviteUrl?: string;
  /** Whether an email was also dispatched. */
  emailSent?: boolean;
  /** Lets the follow-up channel actions target this invitation. */
  invitationId?: string;
  /**
   * The name on the account behind the address, when there is one.
   *
   * Its presence is what puts the choice of channel on screen. Nothing was
   * sent yet in that case: somebody with an account is better served by an
   * in-app notice, which arrives regardless of how email is configured.
   */
  existingAccountName?: string;
}

export interface MemberActionState {
  error?: string;
  success?: string;
}

/**
 * Turns a thrown error into something safe to show.
 *
 * better-auth throws `APIError` with a `body.message`; services throw
 * `ServiceError`. Anything else is unexpected and gets a generic message so
 * internals do not leak into the UI.
 */
function toUserMessage(error: unknown, fallback: string): string {
  if (isServiceError(error)) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "body" in error) {
    const body = (error as { body?: { message?: string } }).body;

    if (body?.message) {
      return body.message;
    }
  }

  return fallback;
}

/**
 * Invites someone to the active shared space.
 *
 * Only the owner may do this, enforced here and again by better-auth. The
 * invite link is returned either way so it can be copied — email is a
 * convenience layer that may not be configured.
 */
export async function inviteMemberAction(
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const parsed = inviteSchema.safeParse({ email: formData.get("email") });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  try {
    const { space } = await requirePermission({ invitation: ["create"] });

    if (space.isPersonal) {
      return { error: "Your personal space is private and cannot be shared." };
    }

    const invitation = await auth.api.createInvitation({
      body: {
        email: parsed.data.email,
        role: "member",
        organizationId: space.id,
      },
      headers: await headers(),
    });

    // The same lookup the email hook just made, and the reason it held off.
    const account = await userRepository.findByEmail(parsed.data.email);

    revalidatePath(MEMBERS_PATH);

    return {
      inviteUrl: buildInvitationUrl(invitation.id),
      invitationId: invitation.id,
      // Nothing is emailed to an existing account until the inviter picks a
      // channel, so this must not claim otherwise.
      emailSent: account ? false : isEmailConfigured(),
      existingAccountName: account?.name || account?.email,
    };
  } catch (error) {
    logger.error("Failed to invite member", error);

    return { error: toUserMessage(error, "Could not send that invitation.") };
  }
}

/**
 * Sends the invitation email for an invitation that is already pending.
 *
 * The owner's explicit choice, offered when the address already has an
 * account — where nothing was emailed automatically.
 */
export async function sendInvitationEmailAction(invitationId: string): Promise<MemberActionState> {
  try {
    const { space } = await requirePermission({ invitation: ["create"] });
    const invitation = await invitationRepository.findByIdWithContext(invitationId);

    // Scoped, not merely found: an id from another space must not become a way
    // to make this app send mail on somebody else's behalf.
    if (!invitation || invitation.organizationId !== space.id) {
      return { error: "That invitation no longer exists." };
    }

    if (!isEmailConfigured()) {
      return { error: "Email is not configured, so the link is the way to share this." };
    }

    await sendInvitationEmail({
      to: invitation.email,
      spaceName: invitation.spaceName,
      inviterName: invitation.inviterName ?? "Someone",
      acceptUrl: buildInvitationUrl(invitation.id),
    });

    return { success: `Invitation emailed to ${invitation.email}.` };
  } catch (error) {
    logger.error("Failed to email an invitation", error, { invitationId });

    return { error: toUserMessage(error, "Could not send that email.") };
  }
}

/**
 * Notifies an existing account about an invitation, inside the app.
 *
 * The notice is account-level rather than space-scoped: the recipient is not a
 * member of the inviting space — that is what is being offered — so a notice
 * tied to that space would be visible to nobody.
 */
export async function notifyInvitationAction(invitationId: string): Promise<MemberActionState> {
  try {
    const { space } = await requirePermission({ invitation: ["create"] });
    const invitation = await invitationRepository.findByIdWithContext(invitationId);

    if (!invitation || invitation.organizationId !== space.id) {
      return { error: "That invitation no longer exists." };
    }

    const account = await userRepository.findByEmail(invitation.email);

    if (!account) {
      return { error: "That address has no account yet, so send the email or the link instead." };
    }

    const outcome = await notificationService.notifyUser(account.id, {
      type: "space_invitation",
      title: `You have been invited to ${invitation.spaceName}`,
      body: `${invitation.inviterName ?? "Someone"} invited you to share the ${invitation.spaceName} ledger.`,
      // Relative: this one is read inside the app, unlike the emailed link.
      href: `/accept-invitation/${invitation.id}`,
      dedupeKey: `invitation:${invitation.id}`,
    });

    // Sending it is the whole action here, so a failure has to be said out
    // loud rather than swallowed the way a trigger's notice can be.
    if (outcome === "failed") {
      return { error: "Could not notify them. Send the link or the email instead." };
    }

    const name = account.name || account.email;

    return {
      success:
        outcome === "duplicate"
          ? `${name} has already been notified about this invitation.`
          : `${name} will see it in the app.`,
    };
  } catch (error) {
    logger.error("Failed to notify an invitation", error, { invitationId });

    return { error: toUserMessage(error, "Could not send that notification.") };
  }
}

/**
 * Withdraws a pending invitation.
 */
export async function cancelInvitationAction(invitationId: string): Promise<MemberActionState> {
  try {
    await requirePermission({ invitation: ["cancel"] });

    await auth.api.cancelInvitation({
      body: { invitationId },
      headers: await headers(),
    });

    revalidatePath(MEMBERS_PATH);

    return { success: "Invitation withdrawn." };
  } catch (error) {
    logger.error("Failed to cancel invitation", error, { invitationId });

    return { error: toUserMessage(error, "Could not withdraw that invitation.") };
  }
}

/**
 * Removes someone from the active space.
 *
 * Their entries stay — `createdBy` is `set null` on user deletion, but
 * removing a membership does not delete the person, so attribution survives.
 */
export async function removeMemberAction(memberIdOrEmail: string): Promise<MemberActionState> {
  try {
    const { space, ctx } = await requirePermission({ member: ["delete"] });

    const members = await spaceService.listMembersWithUser(space.id);
    const target = members.find((candidate) => candidate.id === memberIdOrEmail);

    if (target && target.userId === ctx.userId) {
      return { error: "You cannot remove yourself. Delete the space instead." };
    }

    await auth.api.removeMember({
      body: { memberIdOrEmail, organizationId: space.id },
      headers: await headers(),
    });

    revalidatePath(MEMBERS_PATH);

    return { success: "Member removed." };
  } catch (error) {
    logger.error("Failed to remove member", error, { memberIdOrEmail });

    return { error: toUserMessage(error, "Could not remove that member.") };
  }
}

/**
 * Leaves a shared space.
 *
 * The personal space is not leaveable — it is the fallback every session
 * lands on, and losing it would leave the account with nowhere to write.
 */
export async function leaveSpaceAction(): Promise<MemberActionState> {
  try {
    const { space } = await requireActiveSpace();

    if (space.isPersonal) {
      return { error: "You cannot leave your personal space." };
    }

    await auth.api.leaveOrganization({
      body: { organizationId: space.id },
      headers: await headers(),
    });

    revalidatePath("/", "layout");

    return { success: `You have left ${space.name}.` };
  } catch (error) {
    logger.error("Failed to leave space", error);

    return { error: toUserMessage(error, "Could not leave that space.") };
  }
}
