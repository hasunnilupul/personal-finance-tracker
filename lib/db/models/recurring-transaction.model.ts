import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";

export type RecurringTransaction = InferSelectModel<typeof recurringTransactions>;
export type NewRecurringTransaction = InferInsertModel<typeof recurringTransactions>;
