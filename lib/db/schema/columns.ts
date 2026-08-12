import { text, timestamp } from "drizzle-orm/pg-core";

import { user } from "@/lib/db/schema/better-auth";
import { organization } from "@/lib/db/schema/organization";

/**
 * Columns shared by every space-scoped table.
 *
 * `organizationId` is the tenancy boundary: every read and write is filtered
 * by it, so a row can never leak between a personal ledger and a shared space.
 *
 * `createdBy` / `updatedBy` record attribution, which matters in shared spaces
 * where any member may edit any entry. They are nullable and `set null` on
 * user deletion so a household's history survives someone leaving.
 *
 * Returned from a function rather than exported as a shared object so each
 * table gets its own column builder instances.
 */
export function auditColumns() {
  return {
    organizationId: text("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    createdBy: text("createdBy").references(() => user.id, { onDelete: "set null" }),
    updatedBy: text("updatedBy").references(() => user.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").notNull().defaultNow(),
    updatedAt: timestamp("updatedAt")
      .notNull()
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date()),
  };
}
