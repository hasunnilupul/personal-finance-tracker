"use server";

import { revalidatePath } from "next/cache";

import { requireActiveSpace } from "@/lib/auth/dal";
import { notificationService } from "@/lib/services/notification.service";
import { logger } from "@/lib/logger";

export interface NotificationActionState {
  error?: string;
}

/**
 * Marks one notification read.
 *
 * No permission check beyond membership: the service scopes every write to the
 * acting user as well as the space, so the worst a tampered id can do is
 * update nothing. Read state is personal — a member marking their own copy
 * read leaves everybody else's alone, which is why there is a row per
 * recipient rather than one per event.
 */
export async function markNotificationReadAction(id: number): Promise<NotificationActionState> {
  if (!Number.isInteger(id) || id <= 0) {
    return { error: "That notification could not be identified." };
  }

  try {
    const { ctx } = await requireActiveSpace();

    await notificationService.markRead(ctx, id);
  } catch (error) {
    logger.error("Failed to mark a notification read", error, { id });

    return { error: "Could not update that notification." };
  }

  revalidatePath("/", "layout");

  return {};
}

export async function markAllNotificationsReadAction(): Promise<NotificationActionState> {
  try {
    const { ctx } = await requireActiveSpace();

    await notificationService.markAllRead(ctx);
  } catch (error) {
    logger.error("Failed to mark all notifications read", error);

    return { error: "Could not update your notifications." };
  }

  revalidatePath("/", "layout");

  return {};
}
