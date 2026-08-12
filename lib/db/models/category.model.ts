import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { UserInput } from "@/lib/db/models/types";
import { categories } from "@/lib/db/schema/categories";

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;

/** Fields a caller may set; the service supplies the rest. */
export type CategoryInput = UserInput<NewCategory>;
