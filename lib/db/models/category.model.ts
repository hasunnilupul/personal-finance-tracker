import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { categories } from "@/lib/db/schema/categories";

export type Category = InferSelectModel<typeof categories>;
export type NewCategory = InferInsertModel<typeof categories>;
