import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { expenses } from "@/lib/db/schema/expenses";

export type Expense = InferSelectModel<typeof expenses>;
export type NewExpense = InferInsertModel<typeof expenses>;

/** Fields a caller may set; the service supplies the rest. */
export type ExpenseInput = UserInput<NewExpense>;
