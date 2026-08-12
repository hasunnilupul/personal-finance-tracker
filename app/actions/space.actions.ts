"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/lib/auth/auth";
import { requireUser } from "@/lib/auth/dal";
import { spaceService, toSlug } from "@/lib/services/space.service";
import { logger } from "@/lib/logger";

const createSpaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Give the space a name of at least 2 characters.")
    .max(50, "Keep the name under 50 characters."),
});

export interface SpaceActionState {
  error?: string;
}

/**
 * Creates a shared space and switches to it.
 *
 * Goes through better-auth's endpoint rather than the repository so the
 * creator is recorded as `owner` and the `afterCreateOrganization` hook seeds
 * the default categories.
 */
export async function createSpaceAction(
  _previous: SpaceActionState,
  formData: FormData,
): Promise<SpaceActionState> {
  await requireUser();

  const parsed = createSpaceSchema.safeParse({
    name: formData.get("name"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const requestHeaders = await headers();

  try {
    const space = await auth.api.createOrganization({
      body: {
        name: parsed.data.name,
        slug: toSlug(parsed.data.name),
      },
      headers: requestHeaders,
    });

    if (space) {
      await auth.api.setActiveOrganization({
        body: { organizationId: space.id },
        headers: requestHeaders,
      });
    }
  } catch (error) {
    logger.error("Failed to create space", error);

    return { error: "Could not create the space. Please try again." };
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Switches the session to another space the user belongs to.
 *
 * Membership is verified here rather than trusting the submitted id, so this
 * cannot be used to point a session at a stranger's space.
 */
export async function switchSpaceAction(organizationId: string): Promise<SpaceActionState> {
  const user = await requireUser();

  const membership = await spaceService.getMembership(user.id, organizationId);

  if (!membership) {
    logger.warn("Rejected switch to a space the user is not a member of", {
      userId: user.id,
      organizationId,
    });

    return { error: "You are not a member of that space." };
  }

  await auth.api.setActiveOrganization({
    body: { organizationId },
    headers: await headers(),
  });

  revalidatePath("/", "layout");

  return {};
}
