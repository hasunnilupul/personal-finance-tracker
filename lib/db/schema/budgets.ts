import { pgTable, text, timestamp, integer, varchar, numeric } from "drizzle-orm/pg-core";

export const budgets = pgTable("budgets", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("userId").notNull(),
  categoryId: integer("categoryId").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  period: varchar("period", { length: 20 }).notNull(), // 'monthly', 'yearly'
  startDate: timestamp("startDate").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
