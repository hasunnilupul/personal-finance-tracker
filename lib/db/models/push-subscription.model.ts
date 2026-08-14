import { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { pushSubscriptions } from "@/lib/db/schema/push-subscriptions";

export type PushSubscriptionRecord = InferSelectModel<typeof pushSubscriptions>;
export type NewPushSubscription = InferInsertModel<typeof pushSubscriptions>;

/**
 * What `PushManager.subscribe()` hands back, as far as the server needs it.
 *
 * The browser's own object is not JSON — `toJSON()` produces this shape — so
 * the client sends this and the action parses it rather than trusting it.
 */
export interface PushSubscriptionInput {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}
