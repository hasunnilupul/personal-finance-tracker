import { pgTable, timestamp, integer, varchar, text, index, unique } from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/better-auth";

/**
 * One browser's permission to be pushed to.
 *
 * A person has as many of these as they have devices, so the row belongs to
 * the **user**, not to a space: the notification decides who should hear
 * something, and this decides where they are reachable.
 *
 * `endpoint` is the identity. The browser hands back the same one when the
 * same installation subscribes again, so re-subscribing must update rather
 * than accumulate — hence the unique constraint rather than an id alone. It is
 * a URL that can run past 255 characters, which is why it is `text`.
 *
 * The two keys are the browser's half of the payload encryption. They are not
 * credentials of ours and are useless without the VAPID private key, but they
 * are still somebody's device, so the row cascades away with the user.
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    /** Only to tell one device from another on a "signed in on" list. */
    userAgent: varchar("userAgent", { length: 255 }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    index("push_subscriptions_userId_idx").on(table.userId),
    unique("push_subscriptions_endpoint_key").on(table.endpoint),
  ],
);
