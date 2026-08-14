import { and, count, desc, eq, isNull } from "drizzle-orm";

import { db } from "@/lib/db";
import { notifications } from "@/lib/db/schema/notifications";
import { NewNotification, Notification } from "@/lib/db/models/notification.model";

export class NotificationRepository {
  /**
   * Inserts one, or does nothing if its `dedupeKey` is already taken.
   *
   * `undefined` means it already existed, which is a success — the same
   * contract as `expenseRepository.createIfAbsent`, and for the same reason:
   * every caller here can run twice.
   */
  async createIfAbsent(data: NewNotification): Promise<Notification | undefined> {
    const [result] = await db.insert(notifications).values(data).onConflictDoNothing().returning();

    return result;
  }

  /** Inserts many, skipping any whose key is taken. One statement. */
  async createManyIfAbsent(data: NewNotification[]): Promise<Notification[]> {
    if (data.length === 0) {
      return [];
    }

    return db.insert(notifications).values(data).onConflictDoNothing().returning();
  }

  async listForUser(
    organizationId: string,
    userId: string,
    limit: number,
  ): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(
        and(eq(notifications.organizationId, organizationId), eq(notifications.userId, userId)),
      )
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(limit);
  }

  async countUnread(organizationId: string, userId: string): Promise<number> {
    const [result] = await db
      .select({ value: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      );

    return result?.value ?? 0;
  }

  /** Scoped to the reader as well as the space: read state is personal. */
  async markRead(id: number, organizationId: string, userId: string): Promise<boolean> {
    const result = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.id, id),
          eq(notifications.organizationId, organizationId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });

    return result.length > 0;
  }

  async markAllRead(organizationId: string, userId: string): Promise<number> {
    const result = await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          eq(notifications.userId, userId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });

    return result.length;
  }
}

export const notificationRepository = new NotificationRepository();
