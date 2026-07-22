import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { budgets } from "@/lib/db/schema/budgets";

export type Budget = InferSelectModel<typeof budgets>;
export type NewBudget = InferInsertModel<typeof budgets>;
