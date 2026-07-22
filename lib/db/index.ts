import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";
import { relations } from "@/lib/db/schema/relations";

config({ path: ".env" });

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, relations });
