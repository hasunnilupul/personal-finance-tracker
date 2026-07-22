import { pgTable, text, timestamp, integer, varchar } from "drizzle-orm/pg-core";

export const categories = pgTable("categories", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  userId: text("userId").notNull(),
  name: varchar("name", { length: 50 }).notNull(),
  icon: varchar("icon", { length: 50 }).notNull(),
  color: varchar("color", { length: 7 }).notNull(),
  type: varchar("type", { length: 10 }).notNull(), // 'income' or 'expense'
  createdAt: timestamp("createdAt").notNull().defaultNow(),
});
