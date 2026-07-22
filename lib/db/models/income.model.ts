import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { income } from "@/lib/db/schema/income";

export type Income = InferSelectModel<typeof income>;
export type NewIncome = InferInsertModel<typeof income>;
