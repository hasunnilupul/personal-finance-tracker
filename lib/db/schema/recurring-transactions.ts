import { pgTable, text, timestamp, integer, varchar, numeric } from "drizzle-orm/pg-core";

export const recurringTransactions = pgTable("recurringTransactions", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("userId").notNull(),
  categoryId: integer("categoryId").notNull(),
  type: varchar("type", { length: 10 }).notNull(), // 'expense' or 'income'
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: varchar("description", { length: 255 }),
  frequency: varchar("frequency", { length: 20 }).notNull(), // 'daily', 'weekly', 'monthly', 'yearly'
  nextDate: timestamp("nextDate").notNull(),
  isActive: integer("isActive").notNull().default(1),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
