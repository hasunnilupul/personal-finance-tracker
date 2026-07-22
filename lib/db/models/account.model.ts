import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { account } from "@/lib/db/schema/better-auth";

export type Account = InferSelectModel<typeof account>;
export type NewAccount = InferInsertModel<typeof account>;
