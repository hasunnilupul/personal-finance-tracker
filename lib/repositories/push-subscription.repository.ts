import { eq, inArray } from "drizzle-orm";

import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/db/schema/push-subscriptions";
import {
  NewPushSubscription,
  PushSubscriptionRecord,
} from "@/lib/db/models/push-subscription.model";

export class PushSubscriptionRepository {
  /**
   * Stores a subscription, or refreshes the one already on that endpoint.
   *
   * A browser hands back the same endpoint when the same installation
   * subscribes again — after a permission reset, or simply on a second visit —
   * but its keys may have been rotated. Upserting keeps one row per device and
   * keeps the keys current; inserting would accumulate rows that all push to
   * the same place.
   */
  async upsert(data: NewPushSubscription): Promise<PushSubscriptionRecord> {
    const [result] = await db
      .insert(pushSubscriptions)
      .values(data)
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          userId: data.userId,
          p256dh: data.p256dh,
          auth: data.auth,
          userAgent: data.userAgent ?? null,
        },
      })
      .returning();

    return result;
  }

  async listForUser(userId: string): Promise<PushSubscriptionRecord[]> {
    return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  }

  async listForUsers(userIds: string[]): Promise<PushSubscriptionRecord[]> {
    if (userIds.length === 0) {
      return [];
    }

    return db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  }

  async deleteByEndpoint(endpoint: string): Promise<boolean> {
    const result = await db
      .delete(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, endpoint))
      .returning({ id: pushSubscriptions.id });

    return result.length > 0;
  }

  /** Drops several at once, for endpoints a push server has rejected. */
  async deleteByEndpoints(endpoints: string[]): Promise<number> {
    if (endpoints.length === 0) {
      return 0;
    }

    const result = await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.endpoint, endpoints))
      .returning({ id: pushSubscriptions.id });

    return result.length;
  }
}

export const pushSubscriptionRepository = new PushSubscriptionRepository();
