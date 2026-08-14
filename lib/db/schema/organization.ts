import {
  pgTable,
  text,
  timestamp,
  boolean,
  varchar,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/better-auth";
import { DEFAULT_CURRENCY } from "@/constants/currencies";

/**
 * A space — the container every piece of financial data belongs to.
 *
 * Each user gets exactly one personal space (`isPersonal`), created
 * automatically at sign-up and never shared. Any user can also create shared
 * spaces for joint expenses, and only the creator of a shared space can bring
 * other people into it.
 *
 * Backed by better-auth's `organization` model, so the plugin's endpoints
 * manage the rows.
 */
export const organization = pgTable("organization", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  logo: text("logo"),
  metadata: text("metadata"),
  /** True for the auto-created personal space, which cannot be left or deleted. */
  isPersonal: boolean("is_personal").default(false).notNull(),
  /**
   * The currency this space reports in.
   *
   * Entries may be recorded in any supported currency; each one also stores
   * what it was worth in this currency at the time, and every total is a sum
   * of those.
   */
  baseCurrency: varchar("base_currency", { length: 3 }).default(DEFAULT_CURRENCY).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").$onUpdate(() => /* @__PURE__ */ new Date()),
});

/**
 * Membership of a user in a space, carrying the role that drives every
 * permission check in `lib/auth/permissions.ts`.
 */
export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    uniqueIndex("member_organizationId_userId_uq").on(table.organizationId, table.userId),
  ],
);

/**
 * A pending invitation to join a shared space.
 *
 * Only the space creator can issue these. The row is the source of truth for
 * invite-only sign-up: an email with no pending invitation cannot register.
 */
export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ],
);
