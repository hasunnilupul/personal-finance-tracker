import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { savings } from "@/lib/db/schema/savings";

export type Saving = InferSelectModel<typeof savings>;
export type NewSaving = InferInsertModel<typeof savings>;

/** Fields a caller may set; the service supplies the rest. */
export type SavingInput = UserInput<NewSaving>;
