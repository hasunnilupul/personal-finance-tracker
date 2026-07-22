import { pgTable, text, timestamp, integer, varchar, numeric } from "drizzle-orm/pg-core";

export const savingsGoals = pgTable("savingsGoals", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("userId").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  targetAmount: numeric("targetAmount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("currentAmount", { precision: 12, scale: 2 }).notNull().default("0"),
  deadline: timestamp("deadline"),
  priority: varchar("priority", { length: 20 }).notNull().default("medium"), // 'low', 'medium', 'high'
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
