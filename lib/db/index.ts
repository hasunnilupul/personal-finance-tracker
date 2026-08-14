import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { relations } from "@/lib/db/schema/relations";

// Next.js loads `.env` itself; standalone scripts import "dotenv/config" first.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const sql = neon(process.env.DATABASE_URL!);
export const db = drizzle({ client: sql, relations });
