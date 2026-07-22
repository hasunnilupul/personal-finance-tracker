import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { session } from "@/lib/db/schema/better-auth";

export type Session = InferSelectModel<typeof session>;
export type NewSession = InferInsertModel<typeof session>;
