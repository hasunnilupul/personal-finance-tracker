import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { budgets } from "@/lib/db/schema/budgets";

export type Budget = InferSelectModel<typeof budgets>;
export type NewBudget = InferInsertModel<typeof budgets>;

/** Fields a caller may set; the service supplies the rest. */
export type BudgetInput = UserInput<NewBudget>;
