import { InferInsertModel, InferSelectModel } from "drizzle-orm";

import { notifications } from "@/lib/db/schema/notifications";

export type Notification = InferSelectModel<typeof notifications>;
export type NewNotification = InferInsertModel<typeof notifications>;

/**
 * What the app raises notifications about.
 *
 * The column is a `varchar`, so this is the type-level guard, as with
 * `BudgetPeriod`. Every value is produced by the services here — none arrives
 * from a client — so there is no zod enum to pair it with.
 */
export type NotificationType = "budget_overspend" | "recurring_created" | "space_invitation";

/**
 * A notification as a service raises it.
 *
 * The recipient, the space and the timestamps are the service's to supply, and
 * `dedupeKey` is built from whatever made the event unique — never passed in
 * from outside.
 */
export interface NotificationInput {
  type: NotificationType;
  title: string;
  body: string;
  href?: string | null;
  dedupeKey: string;
}
