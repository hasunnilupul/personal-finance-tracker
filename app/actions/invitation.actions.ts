"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/auth/dal";
import { logger } from "@/lib/logger";

export interface InvitationResponseState {
  error?: string;
}

/**
 * Accepts an invitation and switches to the space it was for.
 *
 * better-auth verifies that the signed-in user's email matches the invitation,
 * so a link cannot be redeemed by whoever happens to find it.
 */
export async function acceptInvitationAction(
  _previous: InvitationResponseState,
  formData: FormData,
): Promise<InvitationResponseState> {
  await requireUser();

  const invitationId = String(formData.get("invitationId") ?? "");

  if (!invitationId) {
    return { error: "That invitation link is missing its id." };
  }

  const requestHeaders = await headers();

  try {
    const result = await auth.api.acceptInvitation({
      body: { invitationId },
      headers: requestHeaders,
    });

    if (result?.invitation?.organizationId) {
      await auth.api.setActiveOrganization({
        body: { organizationId: result.invitation.organizationId },
        headers: requestHeaders,
      });
    }
  } catch (error) {
    logger.error("Failed to accept invitation", error, { invitationId });

    const message =
      typeof error === "object" && error !== null && "body" in error
        ? ((error as { body?: { message?: string } }).body?.message ??
          "Could not accept that invitation.")
        : "Could not accept that invitation.";

    return { error: message };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Declines an invitation.
 */
export async function rejectInvitationAction(
  _previous: InvitationResponseState,
  formData: FormData,
): Promise<InvitationResponseState> {
  await requireUser();

  const invitationId = String(formData.get("invitationId") ?? "");

  if (!invitationId) {
    return { error: "That invitation link is missing its id." };
  }

  try {
    await auth.api.rejectInvitation({
      body: { invitationId },
      headers: await headers(),
    });
  } catch (error) {
    logger.error("Failed to reject invitation", error, { invitationId });

    return { error: "Could not decline that invitation." };
  }

  redirect("/");
}
