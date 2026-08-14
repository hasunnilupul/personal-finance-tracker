// No "server-only" here on purpose, for the same reason as
// `lib/auth/signup-policy.ts`: this is reachable from `lib/auth/auth.ts`, which
// the seed script imports, and that package throws outside Next's bundler.
import { eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { user } from "@/lib/db/schema/better-auth";

export interface AccountSummary {
  id: string;
  name: string;
  email: string;
}

export class UserRepository {
  /**
   * The account behind an email address, if there is one.
   *
   * Emails are stored as entered but compared lowercased everywhere they are
   * accepted — the invite form lowercases through zod, and sign-up does the
   * same — so a plain equality match is enough here.
   */
  async findByEmail(email: string): Promise<AccountSummary | undefined> {
    const [result] = await db
      .select({ id: user.id, name: user.name, email: user.email })
      .from(user)
      .where(eq(user.email, email.trim().toLowerCase()));

    return result;
  }
}

export const userRepository = new UserRepository();
