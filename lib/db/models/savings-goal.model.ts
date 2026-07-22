import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { savingsGoals } from "@/lib/db/schema/savings-goals";

export type SavingsGoal = InferSelectModel<typeof savingsGoals>;
export type NewSavingsGoal = InferInsertModel<typeof savingsGoals>;
