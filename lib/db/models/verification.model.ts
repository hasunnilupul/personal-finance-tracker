import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { verification } from "@/lib/db/schema/better-auth";

export type Verification = InferSelectModel<typeof verification>;
export type NewVerification = InferInsertModel<typeof verification>;
