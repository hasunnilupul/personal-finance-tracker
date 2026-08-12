import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { savingsGoals } from "@/lib/db/schema/savings-goals";

export type SavingsGoal = InferSelectModel<typeof savingsGoals>;
export type NewSavingsGoal = InferInsertModel<typeof savingsGoals>;

/** Fields a caller may set; the service supplies the rest. */
export type SavingsGoalInput = UserInput<NewSavingsGoal>;
