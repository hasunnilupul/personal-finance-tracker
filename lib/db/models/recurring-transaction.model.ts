import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { recurringTransactions } from "@/lib/db/schema/recurring-transactions";

export type RecurringTransaction = InferSelectModel<typeof recurringTransactions>;
export type NewRecurringTransaction = InferInsertModel<typeof recurringTransactions>;

/** Fields a caller may set; the service supplies the rest. */
export type RecurringTransactionInput = UserInput<NewRecurringTransaction>;
