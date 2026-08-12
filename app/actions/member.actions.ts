"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { requireActiveSpace, requirePermission } from "@/lib/auth/dal";
import { buildInvitationUrl } from "@/lib/auth/urls";
import { isEmailConfigured } from "@/lib/email/client";
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

    revalidatePath(MEMBERS_PATH);

    return {
      inviteUrl: buildInvitationUrl(invitation.id),
      emailSent: isEmailConfigured(),
    };
  } catch (error) {
    logger.error("Failed to invite member", error);

    return { error: toUserMessage(error, "Could not send that invitation.") };
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
