import { pgTable, text, timestamp, integer, varchar, numeric } from "drizzle-orm/pg-core";

export const income = pgTable("income", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("userId").notNull(),
  categoryId: integer("categoryId").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),
  date: timestamp("date").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
