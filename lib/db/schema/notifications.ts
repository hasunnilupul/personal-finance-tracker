import { pgTable, timestamp, integer, varchar, text, index, unique } from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/better-auth";
import { organization } from "@/lib/db/schema/organization";

/**
 * Something the app noticed and wants a person to know about.
 *
 * **One row per recipient**, not per event: a shared space notifies every
 * member, and read state belongs to the reader rather than to the household.
 *
 * `dedupeKey` is what makes creating one idempotent, and it carries the whole
 * weight of the feature's correctness. A budget is crossed once per period but
 * every later expense re-crosses it; a recurring sweep can race a page load.
 * Both would notify repeatedly without a key the database refuses to duplicate
 * — the same trick as the `(organizationId, recurringId, date)` occurrence key
 * on `expenses`, for the same reason.
 *
 * Deliberately **no `createdBy` / `updatedBy`**, unlike every other
 * space-scoped table. Those columns record which member authored or last
 * touched a row, and nobody authors a notification: they are raised by a write
 * somebody else made, or by a cron sweep with no acting user at all. A nullable
 * attribution column that is usually null would invite the reading that null
 * means "system", which is not something worth encoding here.
 */
export const notifications = pgTable(
  "notifications",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
    /**
     * The space it belongs to, or **null for an account-level notice**.
     *
     * Almost everything here is about a space, and the bell shows the active
     * one. An invitation is the exception: it reaches somebody who is not a
     * member of the inviting space yet — that is the whole point of it — so
     * scoping it to that space would hide it from the only person who needs
     * it. Null means "about you", and those show wherever you are.
     */
    organizationId: text("organizationId").references(() => organization.id, {
      onDelete: "cascade",
    }),
    /** The member who should see it. */
    userId: text("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    /** `budget_overspend` | `recurring_created` — see `NotificationType`. */
    type: varchar("type", { length: 40 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    body: varchar("body", { length: 400 }).notNull(),
    /** Where reading it should take you, if anywhere. */
    href: varchar("href", { length: 255 }),
    dedupeKey: varchar("dedupeKey", { length: 160 }).notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
  },
  (table) => [
    // The list and the unread count are both "mine, in this space, newest
    // first", which is one index.
    index("notifications_userId_organizationId_createdAt_idx").on(
      table.userId,
      table.organizationId,
      table.createdAt,
    ),
    // The guard, not an optimisation. The service checks before inserting, but
    // a check cannot win a race against a concurrent sweep; this can.
    //
    // `nullsNotDistinct` is what keeps it working for account-level rows.
    // Postgres treats nulls as distinct in a unique index by default, so
    // without it every account-level notice would be unique to itself and the
    // dedupe key would silently stop meaning anything for exactly the rows
    // that repeat most — an invitation re-sent twice.
    unique("notifications_organizationId_userId_dedupeKey_key")
      .on(table.organizationId, table.userId, table.dedupeKey)
      .nullsNotDistinct(),
  ],
);
