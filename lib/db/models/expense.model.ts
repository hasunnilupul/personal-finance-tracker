import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { expenses } from "@/lib/db/schema/expenses";

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;
