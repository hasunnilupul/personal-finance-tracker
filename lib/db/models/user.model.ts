import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { user } from "@/lib/db/schema/better-auth";

export type User = InferSelectModel<typeof user>;
export type NewUser = InferInsertModel<typeof user>;
