"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { requireUser } from "@/lib/auth/dal";
import { pushService } from "@/lib/services/push.service";
import { logger } from "@/lib/logger";

export interface PushActionState {
  error?: string;
  success?: string;
}

/**
 * What the browser's `PushSubscription.toJSON()` produces.
 *
 * Parsed rather than trusted: it arrives from a client, and an endpoint is a
 * URL this server will later make requests to. Anything that is not an https
 * URL has no business being stored.
 */
const subscriptionSchema = z.object({
  endpoint: z.url().refine((value) => value.startsWith("https://"), {
    message: "A push endpoint must be https.",
  }),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

/**
 * Registers this browser to be pushed to.
 *
 * Tied to the signed-in user rather than to a space: a notification decides
 * who should hear something, and this decides where they are reachable.
 */
export async function subscribeToPushAction(subscription: unknown): Promise<PushActionState> {
  const parsed = subscriptionSchema.safeParse(subscription);

  if (!parsed.success) {
    return { error: "That subscription could not be read." };
  }

  try {
    const user = await requireUser();
    const userAgent = (await headers()).get("user-agent") ?? undefined;

    await pushService.subscribe(user.id, parsed.data, userAgent);

    return { success: "This device will get notifications." };
  } catch (error) {
    logger.error("Failed to store a push subscription", error);

    return { error: "Could not turn on notifications for this device." };
  }
}

export async function unsubscribeFromPushAction(endpoint: string): Promise<PushActionState> {
  try {
    await requireUser();
    await pushService.unsubscribe(endpoint);

    return { success: "This device will stop getting notifications." };
  } catch (error) {
    logger.error("Failed to remove a push subscription", error);

    return { error: "Could not turn off notifications for this device." };
  }
}
