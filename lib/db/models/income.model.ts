import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { income } from "@/lib/db/schema/income";

export type Income = InferSelectModel<typeof income>;
export type NewIncome = InferInsertModel<typeof income>;

/** Fields a caller may set; the service supplies the rest. */
export type IncomeInput = UserInput<NewIncome>;
